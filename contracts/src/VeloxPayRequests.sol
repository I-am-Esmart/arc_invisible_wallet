// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VeloxPayRequests
 * @notice Manages programmable ERC-20 payment requests for VeloxPay on Arc.
 * @dev The contract is intentionally not upgradeable. Standard and split
 * requests settle immediately when funded. Protected requests hold funds until
 * the payer releases them after a creator-submitted deliverable, or until a
 * valid refund path is used.
 */
contract VeloxPayRequests is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The denominator used for recipient allocations.
    uint16 public constant BASIS_POINTS = 10_000;

    /// @notice Maximum recipients allowed for a single request.
    uint256 public constant MAX_RECIPIENTS = 10;

    /// @notice Payment behavior selected when a request is created.
    enum PaymentMode {
        STANDARD,
        SPLIT,
        PROTECTED
    }

    /// @notice Lifecycle state for a request.
    enum PaymentStatus {
        OPEN,
        FUNDED,
        SUBMITTED,
        SETTLED,
        REFUNDED,
        CANCELLED
    }

    /**
     * @notice A recipient and their allocation.
     * @param account Recipient wallet address.
     * @param allocationBps Recipient share in basis points.
     */
    struct Recipient {
        address account;
        uint16 allocationBps;
    }

    /**
     * @notice Full on-chain request record.
     * @param id Numeric on-chain request ID.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param creator Address that created the request.
     * @param payer Address that funded the request.
     * @param token ERC-20 token used for payment.
     * @param amount Token amount in base units.
     * @param mode Payment mode.
     * @param status Current payment status.
     * @param createdAt Creation timestamp.
     * @param dueAt Deadline timestamp.
     * @param metadataHash Hash of off-chain request metadata.
     * @param deliverableHash Optional hash of delivered work for protected requests.
     */
    struct PaymentRequest {
        uint256 id;
        bytes32 externalPaymentId;
        address creator;
        address payer;
        IERC20 token;
        uint256 amount;
        PaymentMode mode;
        PaymentStatus status;
        uint64 createdAt;
        uint64 dueAt;
        bytes32 metadataHash;
        bytes32 deliverableHash;
    }

    /// @notice Reverts when an address argument is zero.
    error ZeroAddress();

    /// @notice Reverts when an amount is zero.
    error ZeroAmount();

    /// @notice Reverts when a required hash argument is zero.
    error ZeroHash();

    /// @notice Reverts when a token is not approved by the owner.
    error UnsupportedToken(address token);

    /// @notice Reverts when an external payment ID has already been used.
    error DuplicateExternalPaymentId(bytes32 externalPaymentId);

    /// @notice Reverts when a request does not exist.
    error UnknownRequest(uint256 requestId);

    /// @notice Reverts when a request is not in the required status.
    error InvalidStatus(uint256 requestId, PaymentStatus currentStatus);

    /// @notice Reverts when a terminal request is used again.
    error TerminalRequest(uint256 requestId, PaymentStatus currentStatus);

    /// @notice Reverts when a caller is not the request creator.
    error NotRequestCreator(uint256 requestId, address caller);

    /// @notice Reverts when a caller is not the recorded payer.
    error NotRequestPayer(uint256 requestId, address caller);

    /// @notice Reverts when an operation only supports protected requests.
    error NotProtectedRequest(uint256 requestId);

    /// @notice Reverts when a due timestamp is not in the future.
    error InvalidDueTimestamp(uint64 dueAt);

    /// @notice Reverts when a request has expired.
    error RequestExpired(uint256 requestId, uint64 dueAt);

    /// @notice Reverts when a request has not expired.
    error RequestNotExpired(uint256 requestId, uint64 dueAt);

    /// @notice Reverts when recipient count is zero or exceeds the maximum.
    error InvalidRecipientCount(uint256 count);

    /// @notice Reverts when a standard payment is not configured with exactly one recipient.
    error InvalidStandardRecipientCount(uint256 count);

    /// @notice Reverts when recipient allocations do not total 10,000 bps.
    error InvalidAllocationTotal(uint256 totalBps);

    /// @notice Reverts when a token transfer into the contract does not deliver the exact requested amount.
    error UnexpectedTokenBalanceDelta(uint256 expectedAmount, uint256 receivedAmount);

    /**
     * @notice Emitted when the owner changes token support.
     * @param token ERC-20 token address.
     * @param supported Whether the token is supported.
     */
    event SupportedTokenUpdated(address indexed token, bool supported);

    /**
     * @notice Emitted when a request is created.
     * @param requestId Numeric on-chain request ID.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param creator Request creator.
     * @param token ERC-20 token address.
     * @param amount Token amount in base units.
     * @param mode Payment mode.
     * @param dueAt Deadline timestamp.
     * @param metadataHash Hash of off-chain request metadata.
     * @param recipientCount Number of configured recipients.
     */
    event RequestCreated(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed creator,
        address token,
        uint256 amount,
        PaymentMode mode,
        uint64 dueAt,
        bytes32 metadataHash,
        uint256 recipientCount
    );

    /**
     * @notice Emitted when a request is funded.
     * @param requestId Numeric on-chain request ID.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param payer Payer address.
     * @param token ERC-20 token address.
     * @param amount Token amount in base units.
     * @param mode Payment mode.
     */
    event RequestFunded(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed payer,
        address token,
        uint256 amount,
        PaymentMode mode
    );

    /**
     * @notice Emitted when a protected request creator submits deliverable proof.
     * @param requestId Numeric on-chain request ID.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param creator Request creator.
     * @param deliverableHash Hash of delivered work.
     * @param submittedAt Submission timestamp.
     */
    event DeliverableSubmitted(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed creator,
        bytes32 deliverableHash,
        uint64 submittedAt
    );

    /**
     * @notice Emitted when a request is settled to recipients.
     * @param requestId Numeric on-chain request ID.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param payer Payer address.
     * @param token ERC-20 token address.
     * @param amount Token amount in base units.
     * @param mode Payment mode.
     * @param recipientCount Number of paid recipients.
     */
    event RequestSettled(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed payer,
        address token,
        uint256 amount,
        PaymentMode mode,
        uint256 recipientCount
    );

    /**
     * @notice Emitted when a protected request is refunded to its payer.
     * @param requestId Numeric on-chain request ID.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param payer Payer address.
     * @param token ERC-20 token address.
     * @param amount Token amount in base units.
     * @param refundedBy Caller that triggered the refund.
     */
    event RequestRefunded(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed payer,
        address token,
        uint256 amount,
        address refundedBy
    );

    /**
     * @notice Emitted when an unfunded request is cancelled.
     * @param requestId Numeric on-chain request ID.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param creator Request creator.
     */
    event RequestCancelled(uint256 indexed requestId, bytes32 indexed externalPaymentId, address indexed creator);

    /// @notice Next request ID that will be assigned.
    uint256 public nextRequestId = 1;

    /// @notice Whether an ERC-20 token is supported.
    mapping(address token => bool supported) public supportedTokens;

    /// @notice Looks up the on-chain request ID for an external payment ID.
    mapping(bytes32 externalPaymentId => uint256 requestId) public requestIdByExternalPaymentId;

    mapping(uint256 requestId => PaymentRequest request) private _requests;
    mapping(uint256 requestId => Recipient[] recipients) private _recipients;

    /**
     * @notice Creates the contract with a two-step owner.
     * @param initialOwner Initial owner allowed to manage supported tokens and pause state.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Updates whether an ERC-20 token can be used for new requests.
     * @param token ERC-20 token address.
     * @param supported Whether the token is supported.
     */
    function setSupportedToken(address token, bool supported) external onlyOwner {
        if (token == address(0)) {
            revert ZeroAddress();
        }

        supportedTokens[token] = supported;
        emit SupportedTokenUpdated(token, supported);
    }

    /**
     * @notice Pauses request creation, funding, submission, release, refund, and cancellation.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses request operations.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Creates a new programmable payment request.
     * @param externalPaymentId External VeloxPay payment ID.
     * @param token ERC-20 token address approved by the contract owner.
     * @param amount Token amount in base units.
     * @param mode Payment mode.
     * @param dueAt Deadline timestamp.
     * @param metadataHash Hash of off-chain request metadata.
     * @param recipients One or more recipients with allocations totaling 10,000 bps.
     * @return requestId Numeric on-chain request ID.
     */
    function createRequest(
        bytes32 externalPaymentId,
        address token,
        uint256 amount,
        PaymentMode mode,
        uint64 dueAt,
        bytes32 metadataHash,
        Recipient[] calldata recipients
    ) external whenNotPaused returns (uint256 requestId) {
        if (externalPaymentId == bytes32(0) || metadataHash == bytes32(0)) {
            revert ZeroHash();
        }
        if (requestIdByExternalPaymentId[externalPaymentId] != 0) {
            revert DuplicateExternalPaymentId(externalPaymentId);
        }
        if (token == address(0)) {
            revert ZeroAddress();
        }
        if (!supportedTokens[token]) {
            revert UnsupportedToken(token);
        }
        if (amount == 0) {
            revert ZeroAmount();
        }
        if (dueAt <= block.timestamp) {
            revert InvalidDueTimestamp(dueAt);
        }

        _validateRecipients(mode, recipients);

        requestId = nextRequestId++;
        requestIdByExternalPaymentId[externalPaymentId] = requestId;

        _requests[requestId] = PaymentRequest({
            id: requestId,
            externalPaymentId: externalPaymentId,
            creator: msg.sender,
            payer: address(0),
            token: IERC20(token),
            amount: amount,
            mode: mode,
            status: PaymentStatus.OPEN,
            createdAt: uint64(block.timestamp),
            dueAt: dueAt,
            metadataHash: metadataHash,
            deliverableHash: bytes32(0)
        });

        for (uint256 i = 0; i < recipients.length; ++i) {
            _recipients[requestId].push(recipients[i]);
        }

        emit RequestCreated(
            requestId, externalPaymentId, msg.sender, token, amount, mode, dueAt, metadataHash, recipients.length
        );
    }

    /**
     * @notice Funds a request from the caller.
     * @dev Standard and split requests settle atomically in this call. Protected
     * requests remain escrowed in the contract.
     * @param requestId Numeric on-chain request ID.
     */
    function fundRequest(uint256 requestId) external nonReentrant whenNotPaused {
        PaymentRequest storage request = _existingRequest(requestId);
        _revertIfTerminal(request);

        if (request.status != PaymentStatus.OPEN) {
            revert InvalidStatus(requestId, request.status);
        }
        if (block.timestamp > request.dueAt) {
            revert RequestExpired(requestId, request.dueAt);
        }

        uint256 balanceBefore = request.token.balanceOf(address(this));
        request.token.safeTransferFrom(msg.sender, address(this), request.amount);
        uint256 receivedAmount = request.token.balanceOf(address(this)) - balanceBefore;

        if (receivedAmount != request.amount) {
            revert UnexpectedTokenBalanceDelta(request.amount, receivedAmount);
        }

        request.payer = msg.sender;
        request.status = PaymentStatus.FUNDED;

        emit RequestFunded(
            requestId, request.externalPaymentId, msg.sender, address(request.token), request.amount, request.mode
        );

        if (request.mode != PaymentMode.PROTECTED) {
            _settle(request);
        }
    }

    /**
     * @notice Submits deliverable proof for a protected request.
     * @param requestId Numeric on-chain request ID.
     * @param deliverableHash Hash of delivered work.
     */
    function submitDeliverable(uint256 requestId, bytes32 deliverableHash) external whenNotPaused {
        if (deliverableHash == bytes32(0)) {
            revert ZeroHash();
        }

        PaymentRequest storage request = _existingRequest(requestId);
        _requireProtected(request);
        _requireCreator(request);

        if (request.status != PaymentStatus.FUNDED) {
            revert InvalidStatus(requestId, request.status);
        }
        if (block.timestamp > request.dueAt) {
            revert RequestExpired(requestId, request.dueAt);
        }

        request.deliverableHash = deliverableHash;
        request.status = PaymentStatus.SUBMITTED;

        emit DeliverableSubmitted(
            requestId, request.externalPaymentId, msg.sender, deliverableHash, uint64(block.timestamp)
        );
    }

    /**
     * @notice Approves and releases a protected request to recipients.
     * @param requestId Numeric on-chain request ID.
     */
    function approveProtectedRequest(uint256 requestId) external nonReentrant whenNotPaused {
        PaymentRequest storage request = _existingRequest(requestId);
        _requireProtected(request);
        _requirePayer(request);

        if (request.status != PaymentStatus.SUBMITTED) {
            revert InvalidStatus(requestId, request.status);
        }

        _settle(request);
    }

    /**
     * @notice Lets the creator voluntarily refund an escrowed protected request.
     * @param requestId Numeric on-chain request ID.
     */
    function refundProtectedByCreator(uint256 requestId) external nonReentrant whenNotPaused {
        PaymentRequest storage request = _existingRequest(requestId);
        _requireProtected(request);
        _requireCreator(request);

        if (request.status != PaymentStatus.FUNDED && request.status != PaymentStatus.SUBMITTED) {
            revert InvalidStatus(requestId, request.status);
        }

        _refund(request, msg.sender);
    }

    /**
     * @notice Lets the payer refund an expired protected request if no deliverable was submitted before the deadline.
     * @param requestId Numeric on-chain request ID.
     */
    function refundExpiredProtected(uint256 requestId) external nonReentrant whenNotPaused {
        PaymentRequest storage request = _existingRequest(requestId);
        _requireProtected(request);
        _requirePayer(request);

        if (request.status != PaymentStatus.FUNDED) {
            revert InvalidStatus(requestId, request.status);
        }
        if (block.timestamp <= request.dueAt) {
            revert RequestNotExpired(requestId, request.dueAt);
        }

        _refund(request, msg.sender);
    }

    /**
     * @notice Cancels an unfunded request.
     * @param requestId Numeric on-chain request ID.
     */
    function cancelRequest(uint256 requestId) external whenNotPaused {
        PaymentRequest storage request = _existingRequest(requestId);
        _requireCreator(request);

        if (request.status != PaymentStatus.OPEN) {
            revert InvalidStatus(requestId, request.status);
        }

        request.status = PaymentStatus.CANCELLED;
        emit RequestCancelled(requestId, request.externalPaymentId, msg.sender);
    }

    /**
     * @notice Returns the full request record.
     * @param requestId Numeric on-chain request ID.
     * @return request Full request record.
     */
    function getRequest(uint256 requestId) external view returns (PaymentRequest memory request) {
        request = _requests[requestId];
        if (request.id == 0) {
            revert UnknownRequest(requestId);
        }
    }

    /**
     * @notice Returns all recipients for a request.
     * @param requestId Numeric on-chain request ID.
     * @return recipients Request recipients and allocations.
     */
    function getRecipients(uint256 requestId) external view returns (Recipient[] memory recipients) {
        if (_requests[requestId].id == 0) {
            revert UnknownRequest(requestId);
        }

        return _recipients[requestId];
    }

    /**
     * @notice Returns the number of recipients configured on a request.
     * @param requestId Numeric on-chain request ID.
     * @return count Recipient count.
     */
    function recipientCount(uint256 requestId) external view returns (uint256 count) {
        if (_requests[requestId].id == 0) {
            revert UnknownRequest(requestId);
        }

        return _recipients[requestId].length;
    }

    function _existingRequest(uint256 requestId) private view returns (PaymentRequest storage request) {
        request = _requests[requestId];
        if (request.id == 0) {
            revert UnknownRequest(requestId);
        }
    }

    function _validateRecipients(PaymentMode mode, Recipient[] calldata recipients) private pure {
        uint256 count = recipients.length;
        if (count == 0 || count > MAX_RECIPIENTS) {
            revert InvalidRecipientCount(count);
        }
        if (mode == PaymentMode.STANDARD && count != 1) {
            revert InvalidStandardRecipientCount(count);
        }

        uint256 totalBps;
        for (uint256 i = 0; i < count; ++i) {
            if (recipients[i].account == address(0)) {
                revert ZeroAddress();
            }
            totalBps += recipients[i].allocationBps;
        }

        if (totalBps != BASIS_POINTS) {
            revert InvalidAllocationTotal(totalBps);
        }
    }

    function _settle(PaymentRequest storage request) private {
        request.status = PaymentStatus.SETTLED;
        _distribute(request);

        emit RequestSettled(
            request.id,
            request.externalPaymentId,
            request.payer,
            address(request.token),
            request.amount,
            request.mode,
            _recipients[request.id].length
        );
    }

    function _refund(PaymentRequest storage request, address refundedBy) private {
        request.status = PaymentStatus.REFUNDED;
        request.token.safeTransfer(request.payer, request.amount);

        emit RequestRefunded(
            request.id, request.externalPaymentId, request.payer, address(request.token), request.amount, refundedBy
        );
    }

    function _distribute(PaymentRequest storage request) private {
        Recipient[] storage recipients = _recipients[request.id];
        uint256 lastIndex = recipients.length - 1;
        uint256 remaining = request.amount;

        for (uint256 i = 0; i < lastIndex; ++i) {
            uint256 share = (request.amount * recipients[i].allocationBps) / BASIS_POINTS;
            remaining -= share;
            request.token.safeTransfer(recipients[i].account, share);
        }

        request.token.safeTransfer(recipients[lastIndex].account, remaining);
    }

    function _requireCreator(PaymentRequest storage request) private view {
        if (msg.sender != request.creator) {
            revert NotRequestCreator(request.id, msg.sender);
        }
    }

    function _requirePayer(PaymentRequest storage request) private view {
        if (msg.sender != request.payer) {
            revert NotRequestPayer(request.id, msg.sender);
        }
    }

    function _requireProtected(PaymentRequest storage request) private view {
        if (request.mode != PaymentMode.PROTECTED) {
            revert NotProtectedRequest(request.id);
        }
    }

    function _revertIfTerminal(PaymentRequest storage request) private view {
        if (
            request.status == PaymentStatus.SETTLED || request.status == PaymentStatus.REFUNDED
                || request.status == PaymentStatus.CANCELLED
        ) {
            revert TerminalRequest(request.id, request.status);
        }
    }
}

// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {VeloxPayRequests} from "../src/VeloxPayRequests.sol";

contract MockERC20 is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }

    function mint(address account, uint256 amount) external {
        _mint(account, amount);
    }
}

contract FeeOnTransferToken is MockERC20 {
    uint16 private constant FEE_BPS = 100;
    uint16 private constant BASIS_POINTS = 10_000;

    constructor() MockERC20("Fee USD Coin", "fUSDC", 6) {}

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && value > 0) {
            uint256 fee = (value * FEE_BPS) / BASIS_POINTS;
            super._update(from, address(0), fee);
            super._update(from, to, value - fee);
            return;
        }

        super._update(from, to, value);
    }
}

contract ReentrantToken is MockERC20 {
    VeloxPayRequests private _target;
    uint256 private _targetRequestId;
    bool private _armed;

    bool public attempted;
    bool public blocked;
    bool public succeeded;

    constructor() MockERC20("Reentrant USD Coin", "rUSDC", 6) {}

    function arm(VeloxPayRequests target, uint256 requestId) external {
        _target = target;
        _targetRequestId = requestId;
        _armed = true;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        bool transferred = super.transferFrom(from, to, value);

        if (_armed) {
            _armed = false;
            attempted = true;

            try _target.fundRequest(_targetRequestId) {
                succeeded = true;
            } catch {
                blocked = true;
            }
        }

        return transferred;
    }
}

contract VeloxPayRequestsTest is Test {
    event SupportedTokenUpdated(address indexed token, bool supported);
    event RequestCreated(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed creator,
        address token,
        uint256 amount,
        VeloxPayRequests.PaymentMode mode,
        uint64 dueAt,
        bytes32 metadataHash,
        uint256 recipientCount
    );
    event RequestFunded(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed payer,
        address token,
        uint256 amount,
        VeloxPayRequests.PaymentMode mode
    );
    event DeliverableSubmitted(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed creator,
        bytes32 deliverableHash,
        uint64 submittedAt
    );
    event RequestSettled(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed payer,
        address token,
        uint256 amount,
        VeloxPayRequests.PaymentMode mode,
        uint256 recipientCount
    );
    event RequestRefunded(
        uint256 indexed requestId,
        bytes32 indexed externalPaymentId,
        address indexed payer,
        address token,
        uint256 amount,
        address refundedBy
    );
    event RequestCancelled(uint256 indexed requestId, bytes32 indexed externalPaymentId, address indexed creator);

    VeloxPayRequests private requests;
    MockERC20 private usdc;
    MockERC20 private eurc;

    address private owner = address(0x1001);
    address private creator = address(0x1002);
    address private payer = address(0x1003);
    address private recipientA = address(0x2001);
    address private recipientB = address(0x2002);
    address private stranger = address(0x3001);

    uint256 private constant USDC_AMOUNT = 250e6;
    bytes32 private constant METADATA_HASH = keccak256("veloxpay metadata");
    bytes32 private constant DELIVERABLE_HASH = keccak256("protected deliverable");

    function setUp() public {
        requests = new VeloxPayRequests(owner);
        usdc = new MockERC20("USD Coin", "USDC", 6);
        eurc = new MockERC20("Euro Coin", "EURC", 6);

        vm.startPrank(owner);
        requests.setSupportedToken(address(usdc), true);
        requests.setSupportedToken(address(eurc), true);
        vm.stopPrank();

        usdc.mint(payer, 10_000_000e6);
        eurc.mint(payer, 10_000_000e6);

        vm.startPrank(payer);
        usdc.approve(address(requests), type(uint256).max);
        eurc.approve(address(requests), type(uint256).max);
        vm.stopPrank();
    }

    function testSuccessfulStandardPayment() public {
        bytes32 externalPaymentId = _externalPaymentId("standard-payment");
        uint64 dueAt = _futureDueAt();
        uint256 expectedRequestId = requests.nextRequestId();

        vm.expectEmit(true, true, true, true, address(requests));
        emit RequestCreated(
            expectedRequestId,
            externalPaymentId,
            creator,
            address(usdc),
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            dueAt,
            METADATA_HASH,
            1
        );
        uint256 requestId = _createRequest(
            externalPaymentId,
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            dueAt,
            _singleRecipient(recipientA)
        );

        VeloxPayRequests.PaymentRequest memory beforeFunding = requests.getRequest(requestId);
        assertEq(uint8(beforeFunding.status), uint8(VeloxPayRequests.PaymentStatus.OPEN));
        assertEq(beforeFunding.payer, address(0));
        assertEq(usdc.balanceOf(payer), 10_000_000e6);
        assertEq(usdc.balanceOf(recipientA), 0);
        assertEq(usdc.balanceOf(address(requests)), 0);

        vm.expectEmit(true, true, true, true, address(requests));
        emit RequestFunded(
            requestId, externalPaymentId, payer, address(usdc), USDC_AMOUNT, VeloxPayRequests.PaymentMode.STANDARD
        );
        vm.expectEmit(true, true, true, true, address(requests));
        emit RequestSettled(
            requestId, externalPaymentId, payer, address(usdc), USDC_AMOUNT, VeloxPayRequests.PaymentMode.STANDARD, 1
        );
        vm.prank(payer);
        requests.fundRequest(requestId);

        VeloxPayRequests.PaymentRequest memory afterFunding = requests.getRequest(requestId);
        assertEq(uint8(afterFunding.status), uint8(VeloxPayRequests.PaymentStatus.SETTLED));
        assertEq(afterFunding.payer, payer);
        assertEq(usdc.balanceOf(payer), 10_000_000e6 - USDC_AMOUNT);
        assertEq(usdc.balanceOf(recipientA), USDC_AMOUNT);
        assertEq(usdc.balanceOf(address(requests)), 0);
    }

    function testSuccessfulTwoRecipientSplitPayment() public {
        uint256 amount = 1_000e6;
        uint256 requestId = _createRequest(
            _externalPaymentId("two-recipient-split"),
            usdc,
            amount,
            VeloxPayRequests.PaymentMode.SPLIT,
            _futureDueAt(),
            _twoRecipients(recipientA, recipientB, 6_000, 4_000)
        );

        uint256 payerBefore = usdc.balanceOf(payer);
        _fundRequest(requestId);

        assertEq(usdc.balanceOf(payer), payerBefore - amount);
        assertEq(usdc.balanceOf(recipientA), 600e6);
        assertEq(usdc.balanceOf(recipientB), 400e6);
        assertEq(usdc.balanceOf(address(requests)), 0);
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.SETTLED));
    }

    function testSuccessfulMaximumRecipientSplitPayment() public {
        uint256 amount = 10_000e6;
        VeloxPayRequests.Recipient[] memory recipients = new VeloxPayRequests.Recipient[](10);
        address[] memory accounts = new address[](10);

        for (uint256 i = 0; i < recipients.length; ++i) {
            accounts[i] = vm.addr(0x4000 + i);
            recipients[i] = VeloxPayRequests.Recipient({account: accounts[i], allocationBps: 1_000});
        }

        uint256 requestId = _createRequest(
            _externalPaymentId("max-recipient-split"),
            usdc,
            amount,
            VeloxPayRequests.PaymentMode.SPLIT,
            _futureDueAt(),
            recipients
        );

        assertEq(requests.recipientCount(requestId), 10);
        _fundRequest(requestId);

        for (uint256 i = 0; i < accounts.length; ++i) {
            assertEq(usdc.balanceOf(accounts[i]), 1_000e6);
        }

        assertEq(usdc.balanceOf(address(requests)), 0);
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.SETTLED));
    }

    function testSuccessfulProtectedFunding() public {
        uint256 requestId = _createProtectedRequest();

        _fundRequest(requestId);

        VeloxPayRequests.PaymentRequest memory request = requests.getRequest(requestId);
        assertEq(uint8(request.status), uint8(VeloxPayRequests.PaymentStatus.FUNDED));
        assertEq(request.payer, payer);
        assertEq(usdc.balanceOf(address(requests)), USDC_AMOUNT);
        assertEq(usdc.balanceOf(recipientA), 0);
        assertEq(usdc.balanceOf(recipientB), 0);
    }

    function testDeliverableSubmission() public {
        uint256 requestId = _createProtectedRequest();
        _fundRequest(requestId);

        vm.expectEmit(true, true, true, true, address(requests));
        emit DeliverableSubmitted(
            requestId,
            requests.getRequest(requestId).externalPaymentId,
            creator,
            DELIVERABLE_HASH,
            uint64(block.timestamp)
        );
        vm.prank(creator);
        requests.submitDeliverable(requestId, DELIVERABLE_HASH);

        VeloxPayRequests.PaymentRequest memory request = requests.getRequest(requestId);
        assertEq(uint8(request.status), uint8(VeloxPayRequests.PaymentStatus.SUBMITTED));
        assertEq(request.deliverableHash, DELIVERABLE_HASH);
        assertEq(usdc.balanceOf(address(requests)), USDC_AMOUNT);
    }

    function testProtectedPaymentApprovalAndSplitRelease() public {
        uint256 requestId = _createProtectedRequest();
        _fundRequest(requestId);

        vm.prank(creator);
        requests.submitDeliverable(requestId, DELIVERABLE_HASH);

        vm.expectEmit(true, true, true, true, address(requests));
        emit RequestSettled(
            requestId,
            requests.getRequest(requestId).externalPaymentId,
            payer,
            address(usdc),
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.PROTECTED,
            2
        );
        vm.prank(payer);
        requests.approveProtectedRequest(requestId);

        assertEq(usdc.balanceOf(recipientA), (USDC_AMOUNT * 7_000) / 10_000);
        assertEq(usdc.balanceOf(recipientB), USDC_AMOUNT - ((USDC_AMOUNT * 7_000) / 10_000));
        assertEq(usdc.balanceOf(address(requests)), 0);
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.SETTLED));
    }

    function testCreatorInitiatedRefund() public {
        uint256 requestId = _createProtectedRequest();
        uint256 payerBefore = usdc.balanceOf(payer);
        _fundRequest(requestId);

        assertEq(usdc.balanceOf(payer), payerBefore - USDC_AMOUNT);
        assertEq(usdc.balanceOf(address(requests)), USDC_AMOUNT);

        vm.expectEmit(true, true, true, true, address(requests));
        emit RequestRefunded(
            requestId, requests.getRequest(requestId).externalPaymentId, payer, address(usdc), USDC_AMOUNT, creator
        );
        vm.prank(creator);
        requests.refundProtectedByCreator(requestId);

        assertEq(usdc.balanceOf(payer), payerBefore);
        assertEq(usdc.balanceOf(address(requests)), 0);
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.REFUNDED));
    }

    function testExpiredRequestRefundWhenNoDeliverableExists() public {
        uint64 dueAt = _futureDueAt();
        uint256 requestId = _createRequest(
            _externalPaymentId("expired-refund"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.PROTECTED,
            dueAt,
            _twoRecipients(recipientA, recipientB, 5_000, 5_000)
        );
        uint256 payerBefore = usdc.balanceOf(payer);
        _fundRequest(requestId);

        vm.warp(uint256(dueAt) + 1);
        vm.prank(payer);
        requests.refundExpiredProtected(requestId);

        assertEq(usdc.balanceOf(payer), payerBefore);
        assertEq(usdc.balanceOf(address(requests)), 0);
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.REFUNDED));
    }

    function testRejectExpiredRefundAfterDeliverableWasSubmitted() public {
        uint64 dueAt = _futureDueAt();
        uint256 requestId = _createRequest(
            _externalPaymentId("expired-with-deliverable"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.PROTECTED,
            dueAt,
            _twoRecipients(recipientA, recipientB, 5_000, 5_000)
        );
        _fundRequest(requestId);

        vm.prank(creator);
        requests.submitDeliverable(requestId, DELIVERABLE_HASH);

        vm.warp(uint256(dueAt) + 1);
        vm.expectRevert(
            abi.encodeWithSelector(
                VeloxPayRequests.InvalidStatus.selector, requestId, VeloxPayRequests.PaymentStatus.SUBMITTED
            )
        );
        vm.prank(payer);
        requests.refundExpiredProtected(requestId);

        assertEq(usdc.balanceOf(address(requests)), USDC_AMOUNT);
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.SUBMITTED));
    }

    function testCancellationOfUnfundedRequest() public {
        bytes32 externalPaymentId = _externalPaymentId("cancel");
        uint256 requestId = _createRequest(
            externalPaymentId,
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );

        vm.expectEmit(true, true, true, true, address(requests));
        emit RequestCancelled(requestId, externalPaymentId, creator);
        vm.prank(creator);
        requests.cancelRequest(requestId);

        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.CANCELLED));

        vm.expectRevert(
            abi.encodeWithSelector(
                VeloxPayRequests.TerminalRequest.selector, requestId, VeloxPayRequests.PaymentStatus.CANCELLED
            )
        );
        vm.prank(payer);
        requests.fundRequest(requestId);
    }

    function testRejectAllocationsDoNotTotalTenThousand() public {
        VeloxPayRequests.Recipient[] memory recipients = _twoRecipients(recipientA, recipientB, 6_000, 3_999);

        vm.expectRevert(abi.encodeWithSelector(VeloxPayRequests.InvalidAllocationTotal.selector, 9_999));
        _createRequest(
            _externalPaymentId("bad-allocation"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.SPLIT,
            _futureDueAt(),
            recipients
        );
    }

    function testRejectZeroAddressRecipients() public {
        VeloxPayRequests.Recipient[] memory recipients = _singleRecipient(address(0));

        vm.expectRevert(VeloxPayRequests.ZeroAddress.selector);
        _createRequest(
            _externalPaymentId("zero-recipient"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            recipients
        );
    }

    function testRejectUnsupportedTokens() public {
        MockERC20 unsupported = new MockERC20("Unsupported USD Coin", "uUSDC", 6);

        vm.expectRevert(abi.encodeWithSelector(VeloxPayRequests.UnsupportedToken.selector, address(unsupported)));
        _createRequest(
            _externalPaymentId("unsupported"),
            unsupported,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );
    }

    function testRejectZeroAmount() public {
        vm.expectRevert(VeloxPayRequests.ZeroAmount.selector);
        _createRequest(
            _externalPaymentId("zero-amount"),
            usdc,
            0,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );
    }

    function testRejectDuplicateSettlement() public {
        uint256 requestId = _createRequest(
            _externalPaymentId("duplicate-settle"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );
        _fundRequest(requestId);

        vm.expectRevert(
            abi.encodeWithSelector(
                VeloxPayRequests.TerminalRequest.selector, requestId, VeloxPayRequests.PaymentStatus.SETTLED
            )
        );
        vm.prank(payer);
        requests.fundRequest(requestId);
    }

    function testRejectUnauthorisedSubmission() public {
        uint256 requestId = _createProtectedRequest();
        _fundRequest(requestId);

        vm.expectRevert(abi.encodeWithSelector(VeloxPayRequests.NotRequestCreator.selector, requestId, stranger));
        vm.prank(stranger);
        requests.submitDeliverable(requestId, DELIVERABLE_HASH);
    }

    function testRejectUnauthorisedRelease() public {
        uint256 requestId = _createProtectedRequest();
        _fundRequest(requestId);

        vm.prank(creator);
        requests.submitDeliverable(requestId, DELIVERABLE_HASH);

        vm.expectRevert(abi.encodeWithSelector(VeloxPayRequests.NotRequestPayer.selector, requestId, stranger));
        vm.prank(stranger);
        requests.approveProtectedRequest(requestId);
    }

    function testReentrancyResistanceUsingMaliciousToken() public {
        ReentrantToken token = new ReentrantToken();
        token.mint(payer, 1_000e6);

        vm.prank(owner);
        requests.setSupportedToken(address(token), true);

        uint256 requestId = _createRequest(
            _externalPaymentId("reentrant-token"),
            token,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );

        vm.startPrank(payer);
        token.approve(address(requests), type(uint256).max);
        token.arm(requests, requestId);
        requests.fundRequest(requestId);
        vm.stopPrank();

        assertTrue(token.attempted());
        assertTrue(token.blocked());
        assertFalse(token.succeeded());
        assertEq(token.balanceOf(recipientA), USDC_AMOUNT);
        assertEq(token.balanceOf(address(requests)), 0);
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.SETTLED));
    }

    function testFeeOnTransferTokensAreOutsideSupportedTokenAssumption() public {
        FeeOnTransferToken token = new FeeOnTransferToken();
        token.mint(payer, 1_000e6);

        vm.prank(owner);
        requests.setSupportedToken(address(token), true);

        uint256 requestId = _createRequest(
            _externalPaymentId("fee-token"),
            token,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );

        vm.prank(payer);
        token.approve(address(requests), type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(
                VeloxPayRequests.UnexpectedTokenBalanceDelta.selector, USDC_AMOUNT, (USDC_AMOUNT * 9_900) / 10_000
            )
        );
        vm.prank(payer);
        requests.fundRequest(requestId);

        VeloxPayRequests.PaymentRequest memory request = requests.getRequest(requestId);
        assertEq(uint8(request.status), uint8(VeloxPayRequests.PaymentStatus.OPEN));
        assertEq(request.payer, address(0));
        assertEq(token.balanceOf(address(requests)), 0);
        assertEq(token.balanceOf(recipientA), 0);
    }

    function testPausingAndUnpausing() public {
        vm.prank(owner);
        requests.pause();

        vm.expectRevert(bytes4(keccak256("EnforcedPause()")));
        _createRequest(
            _externalPaymentId("paused"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );

        vm.prank(owner);
        requests.unpause();

        uint256 requestId = _createRequest(
            _externalPaymentId("unpaused"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );
        assertEq(uint8(requests.getRequest(requestId).status), uint8(VeloxPayRequests.PaymentStatus.OPEN));
    }

    function testTokenWhitelistAdministration() public {
        MockERC20 token = new MockERC20("Admin USD Coin", "aUSDC", 6);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        requests.setSupportedToken(address(token), true);

        vm.expectEmit(true, true, true, true, address(requests));
        emit SupportedTokenUpdated(address(token), true);
        vm.prank(owner);
        requests.setSupportedToken(address(token), true);
        assertTrue(requests.supportedTokens(address(token)));

        vm.expectEmit(true, true, true, true, address(requests));
        emit SupportedTokenUpdated(address(token), false);
        vm.prank(owner);
        requests.setSupportedToken(address(token), false);
        assertFalse(requests.supportedTokens(address(token)));
    }

    function testFuzzStandardPaymentsWithValidAmounts(uint96 rawAmount) public {
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000_000e6);
        usdc.mint(payer, amount);

        uint256 requestId = _createRequest(
            _externalPaymentId("fuzz-standard"),
            usdc,
            amount,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );

        uint256 payerBefore = usdc.balanceOf(payer);
        uint256 recipientBefore = usdc.balanceOf(recipientA);
        _fundRequest(requestId);

        assertEq(usdc.balanceOf(payer), payerBefore - amount);
        assertEq(usdc.balanceOf(recipientA), recipientBefore + amount);
        assertEq(usdc.balanceOf(address(requests)), 0);
    }

    function testFuzzSplitAllocationsAndAmounts(uint16 rawFirstBps, uint96 rawAmount) public {
        uint16 firstBps = uint16(bound(uint256(rawFirstBps), 1, 9_999));
        uint16 secondBps = 10_000 - firstBps;
        uint256 amount = bound(uint256(rawAmount), 1, 1_000_000_000e6);
        usdc.mint(payer, amount);

        uint256 requestId = _createRequest(
            _externalPaymentId("fuzz-split"),
            usdc,
            amount,
            VeloxPayRequests.PaymentMode.SPLIT,
            _futureDueAt(),
            _twoRecipients(recipientA, recipientB, firstBps, secondBps)
        );

        uint256 expectedFirst = (amount * firstBps) / 10_000;
        uint256 expectedSecond = amount - expectedFirst;
        uint256 recipientABefore = usdc.balanceOf(recipientA);
        uint256 recipientBBefore = usdc.balanceOf(recipientB);
        _fundRequest(requestId);

        assertEq(usdc.balanceOf(recipientA), recipientABefore + expectedFirst);
        assertEq(usdc.balanceOf(recipientB), recipientBBefore + expectedSecond);
        assertEq(usdc.balanceOf(address(requests)), 0);
    }

    function testEurcUsesSixDecimalBaseUnits() public {
        uint256 amount = 42e6;
        uint256 requestId = _createRequest(
            _externalPaymentId("eurc-standard"),
            eurc,
            amount,
            VeloxPayRequests.PaymentMode.STANDARD,
            _futureDueAt(),
            _singleRecipient(recipientA)
        );

        _fundRequest(requestId);

        assertEq(eurc.decimals(), 6);
        assertEq(eurc.balanceOf(recipientA), amount);
        assertEq(eurc.balanceOf(address(requests)), 0);
    }

    function _createProtectedRequest() private returns (uint256) {
        return _createRequest(
            _externalPaymentId("protected-request"),
            usdc,
            USDC_AMOUNT,
            VeloxPayRequests.PaymentMode.PROTECTED,
            _futureDueAt(),
            _twoRecipients(recipientA, recipientB, 7_000, 3_000)
        );
    }

    function _createRequest(
        bytes32 externalPaymentId,
        MockERC20 token,
        uint256 amount,
        VeloxPayRequests.PaymentMode mode,
        uint64 dueAt,
        VeloxPayRequests.Recipient[] memory recipients
    ) private returns (uint256 requestId) {
        vm.prank(creator);
        requestId =
            requests.createRequest(externalPaymentId, address(token), amount, mode, dueAt, METADATA_HASH, recipients);
    }

    function _fundRequest(uint256 requestId) private {
        vm.prank(payer);
        requests.fundRequest(requestId);
    }

    function _singleRecipient(address account) private pure returns (VeloxPayRequests.Recipient[] memory recipients) {
        recipients = new VeloxPayRequests.Recipient[](1);
        recipients[0] = VeloxPayRequests.Recipient({account: account, allocationBps: 10_000});
    }

    function _twoRecipients(address first, address second, uint16 firstBps, uint16 secondBps)
        private
        pure
        returns (VeloxPayRequests.Recipient[] memory recipients)
    {
        recipients = new VeloxPayRequests.Recipient[](2);
        recipients[0] = VeloxPayRequests.Recipient({account: first, allocationBps: firstBps});
        recipients[1] = VeloxPayRequests.Recipient({account: second, allocationBps: secondBps});
    }

    function _futureDueAt() private view returns (uint64) {
        return uint64(block.timestamp + 7 days);
    }

    function _externalPaymentId(string memory label) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(label));
    }
}

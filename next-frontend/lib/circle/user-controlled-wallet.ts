import type { FeatureStatus } from "@/lib/types/features";

type CircleUserControlledSession = FeatureStatus & {
  appId?: string;
  userToken?: string;
  encryptionKey?: string;
  challengeId?: string;
};

export async function executeCircleUserControlledChallenge(
  session: CircleUserControlledSession,
  onComplete?: (result: unknown) => void,
) {
  if (typeof window === "undefined") {
    throw new Error("Circle user-controlled wallet challenges must run in the browser.");
  }

  if (!session.appId || !session.userToken || !session.encryptionKey || !session.challengeId) {
    throw new Error("Circle user-controlled wallet session is missing appId, userToken, encryptionKey, or challengeId.");
  }

  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const sdk = new W3SSdk({
    appSettings: {
      appId: session.appId,
    },
  });

  sdk.setAuthentication({
    userToken: session.userToken,
    encryptionKey: session.encryptionKey,
  });

  sdk.execute(session.challengeId, onComplete);
}

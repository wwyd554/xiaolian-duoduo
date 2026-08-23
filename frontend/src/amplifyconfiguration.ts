export const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId:
        import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId:
        import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID,
      region: import.meta.env.VITE_AWS_REGION,
      identityPoolId:
        import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
      signUpVerificationMethod: "code" as const,
    },
  },
  API: {
    REST: {
      AISalesRoleplayAPI: {
        endpoint: (
          import.meta.env.VITE_API_GATEWAY_ENDPOINT
        ).replace(/\/$/, ""),
        region: import.meta.env.VITE_AWS_REGION,
      },
    },
  },
  // 补充: Transcribe 的 WebSocket 端点
  TRANSCRIBE: {
    WEBSOCKET: {
      endpoint: import.meta.env.VITE_TRANSCRIBE_WEBSOCKET_URL || "",
    }
  },
};

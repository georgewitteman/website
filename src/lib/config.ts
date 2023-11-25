const IS_PROD = process.env.AWS_EXECUTION_ENV === "AWS_ECS_FARGATE";

export const config = {
  database: {
    exists: !IS_PROD,
  },
  session: {
    secure: IS_PROD,
  },
  express: {
    port: 8080,
    trustProxy: IS_PROD ? 1 : false,
  },
  helmet: {
    strictTransportSecurity: IS_PROD,
    contentSecurityPolicy: IS_PROD,
  },
  nunjucks: {
    noCache: !IS_PROD,
  },
} as const;

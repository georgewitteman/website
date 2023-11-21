const IS_PROD = process.env.AWS_EXECUTION_ENV === "AWS_ECS_FARGATE";

export const config = /** @type {const} */ ({
  database: {
    exists: Boolean(process.env.PGUSER),
  },
  session: {
    secure: IS_PROD,
  },
  express: {
    trustProxy: IS_PROD ? 1 : false,
  },
  helmet: {
    strictTransportSecurity: IS_PROD,
    contentSecurityPolicy: IS_PROD,
  },
  nunjucks: {
    noCache: !IS_PROD,
  },
});

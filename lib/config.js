const IS_PROD = process.env.AWS_EXECUTION_ENV === "AWS_ECS_FARGATE";

export const config = {
  session: {
    secure: IS_PROD,
  },
};

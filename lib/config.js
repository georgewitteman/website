export const config = {
  session: {
    secure: process.env.AWS_EXECUTION_ENV === "AWS_ECS_FARGATE",
  },
};

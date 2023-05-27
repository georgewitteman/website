# website

## Notes

- https://repost.aws/knowledge-center/ecs-fargate-tasks-private-subnet
  - https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html

## Things I'm experimenting with

- No mocking in tests. Use dependency injection instead
- Use JSDoc comments for typing instead of native TypeScript so that I can use native node.js
- Be as strict as possibly with types. For example, try not to use `string`. Instead, use a union of string literals
- Try and understand the internals of everything

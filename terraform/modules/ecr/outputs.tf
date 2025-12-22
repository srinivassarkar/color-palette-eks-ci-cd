output "repository_url" {
  value = aws_ecr_repository.this.repository_url
}

output "irsa_role_arn" {
  value = aws_iam_role.irsa.arn
}
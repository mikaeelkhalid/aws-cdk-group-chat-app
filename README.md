# Serverless Group Chat Application using AWS CDK

[![Mikaeel Khalid](https://badgen.now.sh/badge/by/mikaeelkhalid/purple)](#)

This repo contains an example of a modern serverless group chat application using various AWS services like AWS CDK, AWS AppSync, and AWS Lambda.

Since this app has multiple stacks and we intend to deploy them all, we'll use the `--all` flag.

`cdk synth --all` emits the synthesized CloudFormation templates for all stacks.

`cdk bootstrap` bootstrap the AWS environment if you're deploying the CDK stack for the first time.

`cdk deploy --all` deploy all stacks to your default AWS account/region.

Once deployed successfully, you should be able to see the graphql endpoint in your terminal.


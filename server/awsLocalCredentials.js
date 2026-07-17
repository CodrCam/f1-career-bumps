export const hasLocalAwsCredentials = () => {
  return Boolean(
    (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY)
    || process.env.AWS_PROFILE
    || process.env.AWS_WEB_IDENTITY_TOKEN_FILE
    || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
  );
};

export const printLocalCredentialHelp = () => {
  console.error('');
  console.error('AWS credentials are not configured for this local project.');
  console.error('');
  console.error('Do this once:');
  console.error('1. Copy .env.local.example to .env.local');
  console.error('2. Fill in AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
  console.error('3. Keep AWS_REGION=us-west-2');
  console.error('4. Keep DYNAMODB_TABLE=f1-website-data');
  console.error('');
  console.error('The .env.local file is ignored by git, so secrets stay local.');
};

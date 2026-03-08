const { generateSecret, generate, verify } = require('otplib');

async function test() {
  const secret = generateSecret();
  console.log('Secret:', secret);

  const token = await generate({ secret });
  console.log('Valid Token:', token);

  const isValid = await verify({ token, secret });
  console.log('Is valid token valid?', isValid);

  const isInvalidValid = await verify({ token: '111111', secret });
  console.log('Is "111111" valid?', isInvalidValid);
  
  const isUndefinedTokenValid = await verify({ token: undefined, secret });
  console.log('Is undefined token valid?', isUndefinedTokenValid);

  const isNullTokenValid = await verify({ token: null, secret });
  console.log('Is null token valid?', isNullTokenValid);

  const isBlankTokenValid = await verify({ token: '', secret });
  console.log('Is blank token valid?', isBlankTokenValid);
}

test();

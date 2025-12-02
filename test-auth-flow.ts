import { ethers } from 'ethers';

async function testAuthFlow() {
  const newWallet = ethers.Wallet.createRandom();
  console.log('Address:', newWallet.address);
  console.log('Private Key:', newWallet.privateKey);

  const host = 'http://localhost:3000';
  const nonceResponse = await fetch(
    `${host}/auth/nonce?walletAddress=${newWallet.address}`,
  );
  const nonceData = (await nonceResponse.json()) as {
    nonce: string;
    message: string;
  };
  console.log('Nonce:', nonceData.nonce);
  console.log('Message:', nonceData.message);

  const signature = await newWallet.signMessage(nonceData.message);
  console.log('Signature:', signature);

  const loginResponse = await fetch(`${host}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      walletAddress: newWallet.address,
      signature: signature,
      message: nonceData.message,
      region: 'us',
    }),
  });
  const loginData = (await loginResponse.json()) as {
    accessToken: string;
    refreshToken: string;
    user: {
      id: number;
      walletAddress: string;
    };
  };
  console.log('Login Data:', loginData);
}

testAuthFlow();

'use strict';

const Web3 = require('web3');
const Tx = require('ethereumjs-tx');

const BUCKET = 'my-secure-bucket-for-temporary-storage';
const AWS = require('aws-sdk');
const s3 = new AWS.S3({ sslEnabled: true });

const BANK_ADDRESS = '0x15ae150d7dC03d3B635EE90b85219dBFe071ED35';
const CONTRACT_ADDRESS = '0x07ebda043fb7cba5e1d08254c041d32f2317557c';
const NETWORK_NAME = 'rinkeby';

const abi = [{"constant":false,"inputs":[],"name":"increaseBankFunds","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_value","type":"uint8"}],"name":"sendUserValue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"evaluateBet","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_hash","type":"bytes32"},{"name":"_address","type":"address"}],"name":"setBankHash","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"_value","type":"uint8"}],"name":"debugShowHashForValue","outputs":[{"name":"","type":"bytes32"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"gameRounds","outputs":[{"name":"storedBankHash","type":"bytes32"},{"name":"storedBankValue","type":"uint8"},{"name":"storedUserHash","type":"bytes32"},{"name":"storedUserValue","type":"uint8"},{"name":"storedUserBet","type":"bool"},{"name":"blockWhenValueSubmitted","type":"uint256"},{"name":"lockedFunds","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"showBankAddress","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"getUserAndBankBalance","outputs":[{"name":"","type":"uint256"},{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"lastRouletteNumbers","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"name":"_bet","type":"bool"},{"name":"_hash","type":"bytes32"}],"name":"placeBet","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":false,"inputs":[{"name":"_value","type":"uint8"},{"name":"_address","type":"address"}],"name":"sendBankValue","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"name":"","type":"address"}],"name":"registeredFunds","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[{"name":"_random","type":"uint8"}],"name":"getRouletteNumber","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"pure","type":"function"},{"constant":false,"inputs":[],"name":"retrieveMoney","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"_address","type":"address"}],"name":"checkUserValueTimeout","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"userAddress","type":"address"}],"name":"BankValueWasSet","type":"event"}];

const NETWORK_IDS = {
  // mainnet: 1,
  ropsten: 2,
  rinkeby: 4,
  kovan: 42
};

module.exports.handler = (event, context, callback) => {
  const queryParameter = event["queryStringParameters"];
  const userAddress = queryParameter ? queryParameter['userAddress'] : event.userAddress;
  const bankHash = queryParameter ? queryParameter['bankHash'] : event.bankHash;

  const etherUrl = `https://${NETWORK_NAME}.infura.io/${process.env.INFURA_API_KEY}`;
  const web3 = new Web3(new Web3.providers.HttpProvider(etherUrl));
  const rouletteInstance = web3.eth.contract(abi).at(CONTRACT_ADDRESS);

  const itemKey = `testOn${NETWORK_NAME}/${userAddress}/${bankHash}`;
  console.log({ itemKey });

  s3.getObject({ Bucket: BUCKET, Key: itemKey }, (error, result) => {
    if (error) {
      console.log({ error });
      returnFail(context, error);
    } else {
      const value = result.Body.toString();
      process.chdir('/tmp');
      const data = rouletteInstance.sendBankValue.getData(value, userAddress, {from: BANK_ADDRESS});
      const gasPrice = 9;
      const gasLimit = 3000000;

      const rawTransaction = {
        "from": BANK_ADDRESS,
        "nonce": web3.eth.getTransactionCount(BANK_ADDRESS),
        "gasPrice": web3.toHex(gasPrice * 1e9),
        "gasLimit": web3.toHex(gasLimit),
        "to": CONTRACT_ADDRESS,
        "value": "0x00",
        "data": data,
        "chainId": NETWORK_IDS[NETWORK_NAME],
      };

      const privateKey = process.env.PRIVATE_KEY;
      const privKey = new Buffer(privateKey, 'hex');
      const tx = new Tx(rawTransaction);

      tx.sign(privKey);
      const serializedTx = tx.serialize();

      web3.eth.sendRawTransaction('0x' + serializedTx.toString('hex'), (error, hash) => {
        if (!error) { returnSucceed(context, value); /* TODO remove value */}
        else { returnFail(context, error); }
      });
    }
  });
};

function returnFail(context, error, code = 504) {
  console.log({ error });
  context.fail({
    statusCode: code,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin' : '*', // TODO https://roulette.netlify.com',
      'Access-Control-Allow-Credentials' : true,
    },
    body: error,
  });
}

function returnSucceed(context, body, code = 200) {
  context.succeed({
    statusCode: code,
    headers: {
      'Content-Type': 'text/plain',
      'Access-Control-Allow-Origin' : '*', // TODO https://roulette.netlify.com',
      'Access-Control-Allow-Credentials' : true,
    },
    body: body,
  });
}

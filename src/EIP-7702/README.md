# EIP-7702 Demo

This script demonstrates how to manually construct and send an [EIP-7702](https://eips.ethereum.org/EIPS/eip-7702) transaction. It uses [`viem`](https://viem.sh/) but opts to work with lower level primitives to get a better understanding of the EIP.

## 📦 Setup

```bash
cd eth-playground
pnpm install

# Export the following environment variables in your terminal
export EOA_SEPOLIA_PRIVATE_KEY=0x...
export RELAY_SEPOLIA_PRIVATE_KEY=0x...

# Run the script
cd src/EIP-7702
pnpm run eip7702
```

> Note: Please use caution with your private keys. Don't accidentally commit them to version control. Generally handle them very securely.

### Deploy your own Delegation contract

This demo manually deployed a simple [delegation contract](https://sepolia.etherscan.io/address/0xb8401e6b373ef0d445640bc572e34068480911ec#code) on Sepolia.

You can use something similar to this to deploy your own:
```bash
forge script script/Delegation.s.sol:DelegationScript --rpc-url $SEPOLIA_RPC_URL --account testnet --sender 0x50F1d3b9F5811F333e7Ef77D14B470cEAA08e905 --verify --broadcast

# --account is an imported cast wallet that's locally encrypted. See: https://book.getfoundry.sh/reference/cast/cast-wallet-import
```



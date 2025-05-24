<p align="center">
  <a href="https://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  </a>
  &nbsp;
  <a href="https://app.uniswap.org/" target="_blank">
    <img src="https://1000logos.net/wp-content/uploads/2022/09/Uniswap-Symbol.png" width="250" alt="Nest Logo" />
  </a>
</p>

## Introduction

This NestJS backend hosts two API routes:

1. **`/gasPrice`** - To fetch the Gas price from the Ethereum network.
2. **`/return/:fromTokenAddress/:toTokenAddress/:amountIn`** - To fetch the estimated amount of **`toTokenAddress`** for the given **`amountIn`** of **`fromTokenAddress`**.

## Restrictions

This project strictly follows certain technical restrictions imposed by the problem statement:

1. Usage of [**ethers js v5.7.2**](https://docs.ethers.org/v5/) library and [**Alchemy**](https://www.alchemy.com/)'s RPC endpoint for connecting to the Ethereum Mainnet.
2. No usage of any uniswap packages/SDK (under the scope of @uniswap namespace).

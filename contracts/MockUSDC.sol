// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("Mock USDC", "mUSDC") {
        // Mint initial supply to deployer
        _mint(msg.sender, 1000000 * 10**18); // 1M tokens
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
} 
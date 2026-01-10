// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title CommissionPayout
 * @dev Smart contract for batch commission payouts
 * @notice Allows owner to batch transfer tokens to multiple recipients
 */
contract CommissionPayout is Ownable, ReentrancyGuard, Pausable {
    IERC20 public immutable token;
    
    // Track processed batches to prevent duplicates
    mapping(bytes32 => bool) public processedBatches;
    
    // Track total payouts per recipient
    mapping(address => uint256) public totalPayouts;
    
    // Track payout count
    uint256 public totalPayoutCount;
    
    // Events
    event BatchPayout(
        bytes32 indexed batchId,
        address indexed executor,
        address[] recipients,
        uint256[] amounts,
        uint256 timestamp
    );
    
    event SinglePayout(
        address indexed recipient,
        uint256 amount,
        bytes32 indexed batchId,
        uint256 timestamp
    );
    
    event EmergencyWithdraw(
        address indexed token,
        uint256 amount,
        address indexed to
    );
    
    /**
     * @dev Constructor
     * @param _token Address of the ERC20 token to payout
     */
    constructor(address _token) Ownable(msg.sender) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
    }
    
    /**
     * @dev Batch payout to multiple recipients
     * @param batchId Unique identifier for this batch (to prevent duplicates)
     * @param recipients Array of recipient addresses
     * @param amounts Array of amounts to transfer (must match recipients length)
     */
    function batchPayout(
        bytes32 batchId,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external onlyOwner whenNotPaused nonReentrant {
        require(!processedBatches[batchId], "Batch already processed");
        require(recipients.length > 0, "Empty recipients array");
        require(recipients.length == amounts.length, "Length mismatch");
        require(recipients.length <= 100, "Batch size too large"); // Gas limit protection
        
        processedBatches[batchId] = true;
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        // Check contract has enough balance
        require(
            token.balanceOf(address(this)) >= totalAmount,
            "Insufficient contract balance"
        );
        
        // Transfer tokens to recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Invalid recipient address");
            require(amounts[i] > 0, "Amount must be greater than 0");
            
            bool success = token.transfer(recipients[i], amounts[i]);
            require(success, "Token transfer failed");
            
            totalPayouts[recipients[i]] += amounts[i];
            totalPayoutCount++;
            
            emit SinglePayout(recipients[i], amounts[i], batchId, block.timestamp);
        }
        
        emit BatchPayout(
            batchId,
            msg.sender,
            recipients,
            amounts,
            block.timestamp
        );
    }
    
    /**
     * @dev Get contract token balance
     * @return Balance of tokens in the contract
     */
    function getBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }
    
    /**
     * @dev Get total payout for a specific recipient
     * @param recipient Address to check
     * @return Total amount paid out to recipient
     */
    function getTotalPayout(address recipient) external view returns (uint256) {
        return totalPayouts[recipient];
    }
    
    /**
     * @dev Check if a batch has been processed
     * @param batchId Batch identifier to check
     * @return True if batch has been processed
     */
    function isBatchProcessed(bytes32 batchId) external view returns (bool) {
        return processedBatches[batchId];
    }
    
    /**
     * @dev Pause contract (emergency only)
     */
    function pause() external onlyOwner {
        _pause();
    }
    
    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
    
    /**
     * @dev Emergency withdraw tokens (only if needed)
     * @param to Address to withdraw to
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "Invalid address");
        require(amount > 0, "Amount must be greater than 0");
        require(
            token.balanceOf(address(this)) >= amount,
            "Insufficient balance"
        );
        
        bool success = token.transfer(to, amount);
        require(success, "Transfer failed");
        
        emit EmergencyWithdraw(address(token), amount, to);
    }
    
    /**
     * @dev Transfer ownership (with additional safety check)
     * @param newOwner Address of new owner
     */
    function transferOwnership(address newOwner) public override onlyOwner {
        require(newOwner != address(0), "Invalid new owner");
        super.transferOwnership(newOwner);
    }
}

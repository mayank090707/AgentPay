// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @notice Mock contract that rejects incoming ETH when active.
 *         Used to test TransferFailed custom error on authorizePayment and withdraw.
 */
contract MockRevertingReceiver {
    bool public shouldRevert = true;

    function setRevert(bool _revert) external {
        shouldRevert = _revert;
    }

    receive() external payable {
        if (shouldRevert) {
            revert("Rejecting ETH transfer");
        }
    }
}

/**
 * @notice Mock malicious provider that attempts reentrancy during ETH transfer.
 */
contract MockReentrantProvider {
    address public target;
    bytes32 public targetRequestId;
    bool public attackAttempted;
    bool public attackSucceeded;
    string public attackType;

    constructor(address _target) {
        target = _target;
    }

    function setAttack(string memory _attackType, bytes32 _reqId) external {
        attackType = _attackType;
        targetRequestId = _reqId;
        attackAttempted = false;
        attackSucceeded = false;
    }

    receive() external payable {
        if (!attackAttempted) {
            attackAttempted = true;
            if (keccak256(bytes(attackType)) == keccak256(bytes("authorizePayment"))) {
                (bool ok, ) = target.call(
                    abi.encodeWithSignature(
                        "authorizePayment(bytes32,uint256,address,string)",
                        targetRequestId,
                        msg.value,
                        address(this),
                        "reentrant-hack"
                    )
                );
                if (ok) attackSucceeded = true;
            } else if (keccak256(bytes(attackType)) == keccak256(bytes("withdraw"))) {
                (bool ok, ) = target.call(
                    abi.encodeWithSignature("withdraw(uint256)", msg.value)
                );
                if (ok) attackSucceeded = true;
            }
        }
    }
}

/**
 * @notice Mock contract owner that attempts reentrancy during withdraw().
 */
contract MockReentrantOwner {
    address payable public target;
    bool public attackActive;
    bool public attackAttempted;
    bool public attackSucceeded;

    constructor(address payable _target) {
        target = _target;
    }

    function setTarget(address payable _target) external {
        target = _target;
    }

    function setAttackActive(bool _active) external {
        attackActive = _active;
    }

    function fundTarget() external payable {
        (bool ok, ) = target.call{value: msg.value}(abi.encodeWithSignature("fund()"));
        require(ok, "funding failed");
    }

    function initiateWithdraw(uint256 amount) external {
        (bool ok, ) = target.call(abi.encodeWithSignature("withdraw(uint256)", amount));
        require(ok, "withdraw failed");
    }

    receive() external payable {
        if (attackActive && !attackAttempted) {
            attackAttempted = true;
            // Attempt reentrant withdraw
            (bool ok, ) = target.call(abi.encodeWithSignature("withdraw(uint256)", msg.value));
            if (ok) attackSucceeded = true;
        }
    }
}

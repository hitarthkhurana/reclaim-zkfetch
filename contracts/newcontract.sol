// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@reclaimprotocol/verifier-solidity-sdk/contracts/Reclaim.sol";

contract newTemperatureVerifier is Ownable {
    IERC20 public rewardToken;
    Reclaim public reclaimContract;
    uint256 public constant REWARD_AMOUNT = 1e18;
    
    mapping(address => uint256) public lastVerificationTime;
    mapping(address => uint256) public totalVerifications;
    
    event ProofVerified(
        address indexed user, 
        string sfTemp, 
        string nycTemp
    );
    
    constructor(address _rewardToken) {
        rewardToken = IERC20(_rewardToken);
        reclaimContract = Reclaim(0xAe94FB09711e1c6B057853a515483792d8e474d0);
    }

    function verifyProof(Reclaim.Proof calldata proof) external {
        try reclaimContract.verifyProof(proof) {
        } catch Error(string memory reason) {
            revert(string(abi.encodePacked("Reclaim verification failed: ", reason)));
        } catch {
            revert("Reclaim verification failed with unknown error");
        }
        
        (string memory sfTemp, string memory nycTemp) = parseTemperatures(proof.claimInfo.context);
        int256 sfTempC = parseTemperature(sfTemp);
        int256 nycTempC = parseTemperature(nycTemp);

        require(sfTempC > 10, "SF temperature must be above 10C");
        require(nycTempC < -1, "NYC temperature must be below -1C");
        
        lastVerificationTime[msg.sender] = block.timestamp;
        totalVerifications[msg.sender] += 1;
        
        require(rewardToken.transfer(msg.sender, REWARD_AMOUNT), "Transfer failed");
        
        emit ProofVerified(
            msg.sender, 
            removeQuotes(sfTemp),
            removeQuotes(nycTemp)
        );
    }

    function parseTemperatures(string memory context) public pure returns (string memory sfTemp, string memory nycTemp) {
        bytes memory contextBytes = bytes(context);
        require(contextBytes.length > 0, "Empty context");

        uint256 paramsStart = indexOf(contextBytes, '"extractedParameters":{', 0);
        require(paramsStart != type(uint256).max, "extractedParameters not found");

        uint256 nycStart = indexOf(contextBytes, '"nyc_temp":', paramsStart);
        require(nycStart != type(uint256).max, "nyc_temp not found");
        nycStart = indexOf(contextBytes, '"', nycStart + 10);
        require(nycStart != type(uint256).max, "nyc_temp opening quote not found");
        nycStart += 1;

        uint256 nycEnd = indexOf(contextBytes, '"', nycStart);
        require(nycEnd != type(uint256).max, "nyc_temp end not found");
        require(nycEnd > nycStart, "Invalid nyc_temp value");

        nycTemp = substring(context, nycStart, nycEnd);

        uint256 sfStart = indexOf(contextBytes, '"sf_temp":', nycEnd);
        require(sfStart != type(uint256).max, "sf_temp not found");
        sfStart = indexOf(contextBytes, '"', sfStart + 9);
        require(sfStart != type(uint256).max, "sf_temp opening quote not found");
        sfStart += 1;

        uint256 sfEnd = indexOf(contextBytes, '"', sfStart);
        require(sfEnd != type(uint256).max, "sf_temp end not found");
        require(sfEnd > sfStart, "Invalid sf_temp value");

        sfTemp = substring(context, sfStart, sfEnd);

        require(bytes(sfTemp).length > 0, "Empty SF temperature");
        require(bytes(nycTemp).length > 0, "Empty NYC temperature");
    }

    function removeQuotes(string memory str) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        uint256 length = strBytes.length;
        
        if (length >= 2 && strBytes[0] == '"' && strBytes[length-1] == '"') {
            return substring(str, 1, length-1);
        }
        return str;
    }

    function parseTemperature(string memory temp) public pure returns (int256) {
        bytes memory tempBytes = bytes(temp);
        int256 wholeNumber = 0;
        bool isNegative = false;
        uint256 i = 0;

        if (tempBytes[0] == '-') {
            isNegative = true;
            i = 1;
        }

        for (; i < tempBytes.length; i++) {
            if (tempBytes[i] == '.') {
                break;
            }
            uint8 digit = uint8(tempBytes[i]) - 48;
            require(digit < 10, "Invalid digit");
            wholeNumber = wholeNumber * 10 + int256(uint256(digit));
        }

        return isNegative ? -wholeNumber : wholeNumber;
    }

    function substring(string memory str, uint256 startIndex, uint256 endIndex) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        require(startIndex < strBytes.length, "Start index out of bounds");
        require(endIndex <= strBytes.length, "End index out of bounds");
        require(endIndex > startIndex, "End index must be greater than start index");

        bytes memory result = new bytes(endIndex - startIndex);
        for (uint256 i = 0; i < endIndex - startIndex; i++) {
            result[i] = strBytes[startIndex + i];
        }
        return string(result);
    }

    function indexOf(bytes memory data, string memory search, uint256 startPos) internal pure returns (uint256) {
        bytes memory searchBytes = bytes(search);
        
        if (startPos >= data.length) {
            return type(uint256).max;
        }
        
        if (data.length - startPos < searchBytes.length) {
            return type(uint256).max;
        }
        
        for (uint256 i = startPos; i <= data.length - searchBytes.length; i++) {
            bool found = true;
            
            for (uint256 j = 0; j < searchBytes.length; j++) {
                if (data[i + j] != searchBytes[j]) {
                    found = false;
                    break;
                }
            }
            
            if (found) {
                return i;
            }
        }
        
        return type(uint256).max;
    }

    function getVerificationStats(address user) external view returns (uint256 lastTime, uint256 total) {
        return (lastVerificationTime[user], totalVerifications[user]);
    }

    function setReclaimContract(address _reclaimContract) external onlyOwner {
        reclaimContract = Reclaim(_reclaimContract);
    }
}
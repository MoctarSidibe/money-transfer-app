const hre = require("hardhat");

async function main() {
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUSDC = await MockUSDC.deploy();
  await mockUSDC.waitForDeployment();
  const address = await mockUSDC.getAddress();
  console.log("MockUSDC deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
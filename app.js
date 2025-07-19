const RPC_URL = 'https://carrot.megaeth.com/rpc';

document.addEventListener('DOMContentLoaded', () => {
    const homeSection = document.getElementById('home');
    const erc20FeedSection = document.getElementById('erc20-feed');

    const navLinks = document.querySelectorAll('nav a');

    navLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            const targetId = event.target.getAttribute('href').substring(1);

            if (targetId === 'home') {
                homeSection.classList.remove('hidden');
                erc20FeedSection.classList.add('hidden');
            } else if (targetId === 'erc20-feed') {
                homeSection.classList.add('hidden');
                erc20FeedSection.classList.remove('hidden');
            }
        });
    });

    // Wallet Checker
    const checkBalanceButton = document.getElementById('checkBalance');
    const walletAddressInput = document.getElementById('walletAddress');
    const walletBalanceElement = document.getElementById('walletBalance');

    checkBalanceButton.addEventListener('click', async () => {
        const address = walletAddressInput.value.trim();
        if (!address) {
            walletBalanceElement.textContent = 'Please enter a wallet address.';
            return;
        }

        walletBalanceElement.innerHTML = '<div class="loader"></div>';
        try {
            const balanceResponse = await fetch(RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getBalance',
                    params: [address, 'latest'],
                    id: 1,
                }),
            });

            const balanceData = await balanceResponse.json();
            if (balanceData.error) {
                throw new Error(balanceData.error.message);
            }

            const balanceInWei = parseInt(balanceData.result, 16);
            const balanceInMega = balanceInWei / 1e18;
            walletBalanceElement.textContent = `MEGA: ${balanceInMega.toFixed(4)}`;

            // Fetch wallet activity
            const activityResponse = await fetch(RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getLogs',
                    params: [{
                        fromBlock: '0x0',
                        toBlock: 'latest',
                        topics: [
                            '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
                            null,
                            `0x${address.substring(2).padStart(64, '0')}`
                        ]
                    }],
                    id: 1,
                }),
            });

            const activityData = await activityResponse.json();
            if (activityData.error) {
                throw new Error(activityData.error.message);
            }

            const walletActivityContainer = document.getElementById('wallet-activity');
            walletActivityContainer.innerHTML = ''; // Clear previous activity

            if (activityData.result.length === 0) {
                walletActivityContainer.innerHTML = '<p>No recent activity found.</p>';
                return;
            }

            for (const log of activityData.result) {
                const fromAddress = `0x${log.topics[1].slice(26)}`;
                const toAddress = `0x${log.topics[2].slice(26)}`;
                const amount = parseInt(log.data, 16);

                const activityElement = document.createElement('div');
                activityElement.classList.add('bg-gray-700', 'p-4', 'rounded-lg', 'mb-2');
                activityElement.innerHTML = `
                    <p><strong>From:</strong> ${fromAddress}</p>
                    <p><strong>To:</strong> ${toAddress}</p>
                    <p><strong>Amount:</strong> ${amount / 1e18}</p>
                    <p><strong>Transaction Hash:</strong> <a href="https://megaexplorer.xyz/tx/${log.transactionHash}" target="_blank" class="text-blue-400 hover:underline">${log.transactionHash.substring(0, 20)}...</a></p>
                `;
                walletActivityContainer.appendChild(activityElement);
            }

        } catch (error) {
            walletBalanceElement.textContent = `Error: ${error.message}`;
        }
    });

    // Recent Blocks
    const blocksContainer = document.getElementById('blocks-container');
    const blocksLoader = document.getElementById('blocks-loader');

    async function fetchRecentBlocks() {
        blocksLoader.style.display = 'block';
        try {
            const response = await fetch(RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_blockNumber',
                    params: [],
                    id: 1,
                }),
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }

            const latestBlockNumber = parseInt(data.result, 16);
            document.getElementById('total-blocks-container').textContent = `Total Blocks: ${latestBlockNumber}`;
            blocksContainer.innerHTML = ''; // Clear previous blocks

            for (let i = 0; i < 25; i++) {
                const blockNumber = latestBlockNumber - i;
                const blockResponse = await fetch(RPC_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        jsonrpc: '2.0',
                        method: 'eth_getBlockByNumber',
                        params: ['0x' + blockNumber.toString(16), false],
                        id: 1,
                    }),
                });

                const blockData = await blockResponse.json();
                if (blockData.error) {
                    continue; // Skip if there's an error fetching a block
                }

                const block = blockData.result;
                const gasUsed = parseInt(block.gasUsed, 16);
                const timestamp = new Date(parseInt(block.timestamp, 16) * 1000).toLocaleString();

                const blockElement = document.createElement('tr');
                blockElement.innerHTML = `
                    <td class="p-2">${blockNumber}</td>
                    <td class="p-2">${timestamp}</td>
                    <td class="p-2">${gasUsed}</td>
                    <td class="p-2"><a href="https://megaexplorer.xyz/block/${block.hash}" target="_blank" class="text-blue-400 hover:underline">${block.hash.substring(0, 20)}...</a></td>
                `;
                blocksContainer.appendChild(blockElement);
            }
        } catch (error) {
            blocksContainer.innerHTML = `<p class="text-red-500">Error fetching blocks: ${error.message}</p>`;
        } finally {
            blocksLoader.style.display = 'none';
        }
    }

    fetchRecentBlocks();
    setInterval(fetchRecentBlocks, 15000);

    // ERC-20 Transfer Feed
    const transfersContainer = document.getElementById('transfers-container');
    const transfersLoader = document.getElementById('transfers-loader');
    const filterTransfersButton = document.getElementById('filterTransfers');
    const contractAddressInput = document.getElementById('contractAddress');

    async function fetchErc20Transfers() {
        transfersLoader.style.display = 'block';
        const contractAddress = contractAddressInput.value.trim();
        const params = {
            fromBlock: 'latest',
            toBlock: 'latest',
            topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'],
        };

        if (contractAddress) {
            params.address = contractAddress;
        }

        try {
            const response = await fetch(RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getLogs',
                    params: [params],
                    id: 1,
                }),
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }

            transfersContainer.innerHTML = ''; // Clear previous transfers
            if (data.result.length === 0) {
                transfersContainer.innerHTML = '<p>No recent ERC-20 transfers found.</p>';
                return;
            }


            for (const log of data.result) {
                const fromAddress = `0x${log.topics[1].slice(26)}`;
                const toAddress = `0x${log.topics[2].slice(26)}`;
                const amount = parseInt(log.data, 16);

                const transferElement = document.createElement('div');
                transferElement.classList.add('bg-gray-700', 'p-4', 'rounded-lg');
                transferElement.innerHTML = `
                    <p><strong>From:</strong> ${fromAddress}</p>
                    <p><strong>To:</strong> ${toAddress}</p>
                    <p><strong>Amount:</strong> ${amount / 1e18} </p>
                    <p><strong>Transaction Hash:</strong> <a href="https://megaexplorer.xyz/tx/${log.transactionHash}" target="_blank" class="text-blue-400 hover:underline">${log.transactionHash.substring(0, 20)}...</a></p>
                `;
                transfersContainer.appendChild(transferElement);
            }
        } catch (error) {
            transfersContainer.innerHTML = `<p class="text-red-500">Error fetching transfers: ${error.message}</p>`;
        } finally {
            transfersLoader.style.display = 'none';
        }
    }

    filterTransfersButton.addEventListener('click', fetchErc20Transfers);
    fetchErc20Transfers(); // Initial fetch
    setInterval(fetchErc20Transfers, 10000); // Poll every 10 seconds

    // Contract Inspector
    const inspectContractButton = document.getElementById('inspectContract');
    const inspectorAddressInput = document.getElementById('inspectorAddress');
    const contractInfoContainer = document.getElementById('contract-info');

    inspectContractButton.addEventListener('click', async () => {
        const address = inspectorAddressInput.value.trim();
        if (!address) {
            contractInfoContainer.innerHTML = '<p>Please enter a contract address.</p>';
            return;
        }

        try {
            const response = await fetch(RPC_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'eth_getCode',
                    params: [address, 'latest'],
                    id: 1,
                }),
            });

            const data = await response.json();
            if (data.error) {
                throw new Error(data.error.message);
            }

            const bytecode = data.result;
            if (bytecode === '0x') {
                contractInfoContainer.innerHTML = '<p>Not a contract.</p>';
                return;
            }

            const bytecodeSize = (bytecode.length - 2) / 2;
            contractInfoContainer.innerHTML = `
                <p><strong>Bytecode Size:</strong> ${bytecodeSize} bytes</p>
                <p><strong>Bytecode (first 30 chars):</strong> ${bytecode.substring(0, 32)}...</p>
                <p><a href="https://megaexplorer.xyz/address/${address}" target="_blank" class="text-blue-400 hover:underline">View on MegaExplorer</a></p>
            `;
        } catch (error) {
            contractInfoContainer.innerHTML = `<p class="text-red-500">Error inspecting contract: ${error.message}</p>`;
        }
    });
});

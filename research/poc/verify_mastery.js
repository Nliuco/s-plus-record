const axios = require('axios');
const https = require('https');

/**
 * ========================================================
 * 用于验证本地 LCU remoting 接口可抓取 champion mastery。
 *
 * 你需要提供两个环境变量：
 * - `LCU_PORT`：通常是 127.0.0.1 上的端口
 * - `LCU_TOKEN`：remoting-auth-token（注意不要提交到仓库的真实 token）
 *
 * 例子（PowerShell）：
 *   $env:LCU_PORT="61527"
 *   $env:LCU_TOKEN="r-xxx"
 *   node research/poc/verify_mastery.js
 * ========================================================
 */
const PORT = process.env.LCU_PORT || ''
const TOKEN = process.env.LCU_TOKEN || ''

if (!PORT || !TOKEN) {
  console.error('缺少环境变量：请设置 LCU_PORT 和 LCU_TOKEN 后再运行。')
  console.error('例如：')
  console.error('  set LCU_PORT=61527')
  console.error('  set LCU_TOKEN=r-xxx')
  process.exit(1)
}
/** ======================================================== */

const agent = new https.Agent({ rejectUnauthorized: false });

async function verify() {
    console.log(`正在尝试连接接口: https://127.0.0.1:${PORT}...`);

    try {
        const response = await axios({
            method: 'get',
            url: `https://127.0.0.1:${PORT}/lol-champion-mastery/v1/local-player/champion-mastery`,
            headers: {
                'Authorization': `Basic ${Buffer.from(`riot:${TOKEN}`).toString('base64')}`,
                'Accept': 'application/json'
            },
            httpsAgent: agent,
            timeout: 5000
        });

        const data = response.data;
        console.log('\n✅ 【验证成功！】接口已成功返回数据。');
        console.log('------------------------------------------------');
        console.log(`- 本赛季已玩过的英雄总数: ${data.length}`);
        
        const sPlusList = data.filter(i => i.highestGrade === 'S+');
        console.log(`- 本赛季已获得 S+ 的英雄数: ${sPlusList.length}`);
        
        console.log('\n数据预览 (前 10 个英雄):');
        console.log('英雄ID\t\t本赛季评分');
        console.log('---------------------------');
        data.slice(0, 10).forEach(item => {
            console.log(`${item.championId}\t\t${item.highestGrade || '-'}`);
        });

        console.log('\n【最终结论】: 数据完全可抓取，App 开发方案可行。');
        console.log('我们可以开始正式的项目设计了。');

    } catch (error) {
        console.error('\n❌ 连接接口失败：');
        if (error.response) {
            console.error(`- 状态码: ${error.response.status}`);
            console.error('- 说明: 端口和令牌解析正确，但服务器拒绝了请求。');
        } else {
            console.error(`- 错误信息: ${error.message}`);
        }
    }
}

verify();

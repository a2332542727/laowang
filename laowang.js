const axios = require('axios');

// 时间格式化函数
function log(msg) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
  console.log(`[${now}] ${msg}`);
}

(async () => {
  try {
    log('开始执行自动签到任务');

    // 1. 访问登录页面，提取参数
    log('请求登录页面...');
    const loginPage = await axios.get('https://laowang.vip/member.php?mod=logging&action=login', {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const html = loginPage.data;
    const formhash = html.match(/name="formhash" value="(\w+)"/)?.[1];
    const referer = html.match(/name="referer" value="([^"]*)"/)?.[1] || '';
    const loginhash = html.match(/loginhash=(\w+)/)?.[1];

    if (!formhash || !loginhash) {
      log('❌ 无法提取登录参数（formhash 或 loginhash）');
      return;
    }

    const loginUrl = `https://laowang.vip/member.php?mod=logging&action=login&loginsubmit=yes&loginhash=${loginhash}&inajax=1`;

    const username = 'jyln';
    const passwordPlain = '963852741aA.';
    const passwordEncoded = `base64://${Buffer.from(passwordPlain + 'A.').toString('base64')}`;

    const loginData = new URLSearchParams({
      formhash,
      referer,
      username,
      password: passwordEncoded,
      questionid: '0',
      answer: '',
      cookietime: '2592000'
    });

    const cookies = loginPage.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';

    log('提交登录请求...');
    const loginResp = await axios.post(loginUrl, loginData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookies,
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const loginCookies = loginResp.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ');
    const fullCookie = cookies + (loginCookies ? '; ' + loginCookies : '');

    log('登录成功，正在访问签到页面...');
    const signPage = await axios.get('https://laowang.vip/plugin.php?id=k_misign:sign', {
      headers: {
        'Cookie': fullCookie,
        'User-Agent': 'Mozilla/5.0'
      }
    });

    const signFormhash = signPage.data.match(/name="formhash" value="(\w+)"/)?.[1];
    if (!signFormhash) {
      log('❌ 未能提取签到页面中的 formhash');
      return;
    }

    const signUrl = `https://laowang.vip/plugin.php?id=k_misign:sign&operation=qiandao&formhash=${signFormhash}&format=empty`;
    log('发送签到请求...');
    const signResp = await axios.get(signUrl, {
      headers: {
        'Cookie': fullCookie,
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (signResp.status === 200) {
      log('✅ 签到请求已发送，检查响应以确认是否成功（服务端可能未返回内容）');
    } else {
      log(`⚠️ 签到请求返回状态码：${signResp.status}`);
    }

    log('自动签到任务完成。');
  } catch (err) {
    log(`❌ 执行过程中出现错误：${err.message}`);
    console.error(err);
  }
})();

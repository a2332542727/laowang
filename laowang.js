const puppeteer = require('puppeteer');
const axios = require('axios');

// 时间格式化函数
function log(msg) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\..+/, '');
  console.log(`[${now}] ${msg}`);
}

(async () => {
  try {
    log('启动 Puppeteer 浏览器...');
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0');
    log('访问登录页面...');
    await page.goto('https://laowang.vip/member.php?mod=logging&action=login', { waitUntil: 'networkidle2' });

    // 填入用户名和密码（按实际登录表单结构适配）
    await page.type('input[name="username"]', 'abcddde');
    await page.type('input[name="password"]', 'Aa963852741.');

    // 等待并点击“点击进行验证”按钮（触发滑块）
    log('等待“点击进行验证”按钮...');
    await page.waitForSelector('#tncode', { timeout: 10000 });
    await page.click('#tncode');
    log('已点击“点击进行验证”，等待滑块加载...');

    // 等待 Geetest 滑块验证码 iframe 加载（通常需要 iframe + 里面加载完成）
    const maxWaitTime = 15000;
    let sliderFrame = null;

    await page.waitForTimeout(2000); // 等一会儿，等待验证码加载

    for (let i = 0; i < 10; i++) {
      sliderFrame = page.frames().find(f =>
        f.url().includes('geetest') || f.name().includes('geetest') || f.name().includes('gt_iframe')
      );
      if (sliderFrame) break;
      await page.waitForTimeout(1000);
    }

    if (!sliderFrame) {
      log('❌ 未检测到滑块验证码框架，可能验证方式不同或尚未加载。');
      await browser.close();
      return;
    }

    log('等待滑块验证并手动或自动通过...');
    await page.waitForFunction(() => {
      const success = document.querySelector('.gt_info_type_success') || document.querySelector('.geetest_success_radar_tip');
      return success && success.offsetParent !== null;
    }, { timeout: 30000 }).catch(() => {
      throw new Error('滑块验证未能在 30 秒内通过');
    });

    log('滑块验证通过，提交登录表单...');
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
    ]);

    const cookies = await page.cookies();
    const cookieStr = cookies.map(c => `${c.name}=${c.value}`).join('; ');

    await browser.close();
    log('浏览器关闭，使用 Cookie 执行签到流程...');

    log('访问签到页面...');
    const signPage = await axios.get('https://laowang.vip/plugin.php?id=k_misign:sign', {
      headers: {
        'Cookie': cookieStr,
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
        'Cookie': cookieStr,
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

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
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    await page.setUserAgent('Mozilla/5.0');
    log('访问登录页面...');
    await page.goto('https://laowang.vip/member.php?mod=logging&action=login', { waitUntil: 'networkidle2' });

    // 填入用户名和密码（按实际登录表单结构适配）
    await page.type('input[name="username"]', 'abcddde');
    await page.type('input[name="password"]', 'Aa963852741.');

    // 检查是否出现滑块
    log('等待滑块验证码出现...');
    const sliderFrame = await page
      .frames()
      .find(f => f.url().includes('geetest') || f.name().includes('geetest') || f.name().includes('gt_iframe'));

    if (!sliderFrame) {
      log('❌ 未检测到滑块验证码框架，可能验证方式不同或尚未加载。');
      await browser.close();
      return;
    }

    // 通常滑块拖动模拟比较复杂，这里使用页面点击登录按钮触发验证码并等待验证通过
    log('等待滑块验证并手动或自动通过...');
    // 这里可以尝试集成滑块破解库，但不推荐，容易失效

    await page.waitForFunction(() => {
      const success = document.querySelector('.gt_info_type_success') || document.querySelector('.geetest_success_radar_tip');
      return success && success.offsetParent !== null;
    }, { timeout: 30000 }).catch(() => {
      throw new Error('滑块验证未能在 30 秒内通过');
    });

    log('滑块验证通过，提交登录表单...');
    await Promise.all([
      page.click('button[type="submit"]'), // 或者具体登录按钮选择器
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

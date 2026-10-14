const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'your-username/your-repo';
const GITHUB_BRANCH = 'main';

async function getFileContent(filename) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}?ref=${GITHUB_BRANCH}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3.raw'
      }
    });

    if (response.status === 404) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.error('Error fetching file:', error);
    return null;
  }
}

async function updateFileContent(filename, content, message) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_REPO}/contents/${filename}`;

    const currentContent = await getFileContent(filename);
    let sha = null;

    if (currentContent) {
      const infoResponse = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      const info = await infoResponse.json();
      sha = info.sha;
    }

    const body = {
      message: message,
      content: Buffer.from(content).toString('base64'),
      branch: GITHUB_BRANCH
    };

    if (sha) {
      body.sha = sha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    return response.ok;
  } catch (error) {
    console.error('Error updating file:', error);
    return false;
  }
}

exports.handler = async (event) => {
  const { action, username, totalCookies, level, clickCount, cookiePerClick, autoProduction, autoProductionCost } = JSON.parse(event.body);

  try {
    if (action === 'get') {
      const leaderboardContent = await getFileContent('data/leaderboard.json');
      const leaderboard = leaderboardContent ? JSON.parse(leaderboardContent) : {};

      const sorted = Object.entries(leaderboard)
        .map(([user, data]) => ({
          username: user,
          totalCookies: data.totalCookies || 0
        }))
        .sort((a, b) => b.totalCookies - a.totalCookies)
        .slice(0, 10);

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, leaderboard: sorted })
      };
    }

    if (action === 'update') {
      if (!username) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '사용자명이 필요합니다' })
        };
      }

      const leaderboardContent = await getFileContent('data/leaderboard.json');
      let leaderboard = leaderboardContent ? JSON.parse(leaderboardContent) : {};

      leaderboard[username] = {
        totalCookies: totalCookies || 0,
        level: level || 1,
        clickCount: clickCount || 0,
        cookiePerClick: cookiePerClick || 1,
        autoProduction: autoProduction || 0,
        autoProductionCost: autoProductionCost || 200,
        lastUpdated: new Date().toISOString()
      };

      const success = await updateFileContent(
        'data/leaderboard.json',
        JSON.stringify(leaderboard, null, 2),
        `Update leaderboard: ${username}`
      );

      if (success) {
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else {
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: '리더보드 업데이트 중 오류가 발생했습니다' })
        };
      }
    }

    if (action === 'getPlayerData') {
      if (!username) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '사용자명이 필요합니다' })
        };
      }

      const leaderboardContent = await getFileContent('data/leaderboard.json');
      const leaderboard = leaderboardContent ? JSON.parse(leaderboardContent) : {};

      const playerData = leaderboard[username] || {
        totalCookies: 0,
        level: 1,
        clickCount: 0,
        cookiePerClick: 1,
        autoProduction: 0,
        autoProductionCost: 200
      };

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, data: playerData })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: '잘못된 요청입니다' })
    };
  } catch (error) {
    console.error('Leaderboard error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: '서버 오류가 발생했습니다' })
    };
  }
};

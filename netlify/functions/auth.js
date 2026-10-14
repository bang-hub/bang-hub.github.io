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

function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

exports.handler = async (event) => {
  const { action, username, password, passwordConfirm } = JSON.parse(event.body);

  try {
    if (action === 'register') {
      if (!username || !password) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '사용자명과 비밀번호를 입력하세요' })
        };
      }

      if (username.length < 3 || username.length > 20) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '사용자명은 3-20자여야 합니다' })
        };
      }

      if (password.length < 6) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '비밀번호는 최소 6자여야 합니다' })
        };
      }

      if (password !== passwordConfirm) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '비밀번호가 일치하지 않습니다' })
        };
      }

      const usersContent = await getFileContent('data/users.json');
      let users = usersContent ? JSON.parse(usersContent) : {};

      if (users[username]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '이미 존재하는 사용자명입니다' })
        };
      }

      users[username] = {
        password: hashPassword(password),
        createdAt: new Date().toISOString()
      };

      const success = await updateFileContent(
        'data/users.json',
        JSON.stringify(users, null, 2),
        `Register user: ${username}`
      );

      if (success) {
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true })
        };
      } else {
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: '회원가입 중 오류가 발생했습니다' })
        };
      }
    }

    if (action === 'login') {
      if (!username || !password) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '사용자명과 비밀번호를 입력하세요' })
        };
      }

      const usersContent = await getFileContent('data/users.json');
      const users = usersContent ? JSON.parse(usersContent) : {};

      if (!users[username]) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '존재하지 않는 사용자명입니다' })
        };
      }

      if (users[username].password !== hashPassword(password)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ success: false, error: '비밀번호가 잘못되었습니다' })
        };
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ success: true })
      };
    }

    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: '잘못된 요청입니다' })
    };
  } catch (error) {
    console.error('Auth error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: '서버 오류가 발생했습니다' })
    };
  }
};

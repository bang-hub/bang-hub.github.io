const https = require('https');

function makeGitHubRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const token = process.env.GITHUB_TOKEN;
        const repo = process.env.GITHUB_REPO;

        if (!token || !repo) {
            reject(new Error('GitHub 환경 변수 설정 필요'));
            return;
        }

        const options = {
            hostname: 'api.github.com',
            path: path,
            method: method,
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json',
                'User-Agent': 'Netlify-Function'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({
                        status: res.statusCode,
                        data: data ? JSON.parse(data) : null,
                        headers: res.headers
                    });
                } catch (e) {
                    resolve({
                        status: res.statusCode,
                        data: data,
                        headers: res.headers
                    });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function getUsers() {
    const repo = process.env.GITHUB_REPO;
    const path = `/repos/${repo}/contents/users.json`;

    try {
        const response = await makeGitHubRequest('GET', path);
        if (response.status === 404) {
            return {};
        }
        if (response.status === 200) {
            const content = Buffer.from(response.data.content, 'base64').toString();
            return JSON.parse(content);
        }
        throw new Error(`GitHub API error: ${response.status}`);
    } catch (error) {
        console.error('사용자 조회 실패:', error);
        throw error;
    }
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }

    try {
        const { username, password } = JSON.parse(event.body);

        if (!username || !password) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: '아이디와 비밀번호를 입력해주세요.' })
            };
        }

        const users = await getUsers();

        if (!users[username]) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: '존재하지 않는 아이디입니다.' })
            };
        }

        if (users[username] !== password) {
            return {
                statusCode: 401,
                body: JSON.stringify({ error: '비밀번호가 올바르지 않습니다.' })
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ message: '로그인 성공!', username: username })
        };
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '로그인 중 오류가 발생했습니다.' })
        };
    }
};

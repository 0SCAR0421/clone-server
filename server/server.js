// server engine
const express = require('express')
const HTTPS = require('https');
const port = process.env.PORT || 3000
require("dotenv").config({path: "../.env"})

// file system
const fs = require('fs')
const path = require('path');
const static = require('serve-static')

// image process
const fileUpload = require('express-fileupload');

// cors
const cors = require('cors')

// use lib
const runQuery = require('../lib/dbquery.js')

// jwt
const { generateToken, verifyToken } = require('../lib/jwt.js');

// cookie
const cookieParser = require('cookie-parser');

// server start
const app = express()

// midleware
app.use(express.urlencoded({ extended: true }))
app.use(express.json())
app.use(static(__dirname + "/../"))
app.use(cookieParser())

app.get('/', async (req, res) => {
  res.send('hello world')
})

app.get('/api', async (req, res) => {
  res.send('api server')
})

app.get('/api/users', async (req, res) => {
  const sql = 'SELECT * FROM Users'
  const resData = await runQuery.fetchData(sql)

  res.json(resData)
})

app.post('/api/questions/ask', async (req, res) => {
  const body = req.body
  const sql = `INSERT INTO Questions(Question_id, Question_title, Question_content, Question_Userid) VALUES(${body.Question_id}, '${body.Question_title}', '${body.Question_content}', '${body.Question_Userid}')`
  const resData = await runQuery.fetchData(sql)

  res.json(resData)
})

const promiseReaddir = (dirnameHead, dirnameTail) => {
  return new Promise((resolve, rejects) => {
    fs.readdir(`${__dirname}/../src/${dirnameHead}/${dirnameTail}`, (msg) => {
      if(msg !== null) {
        rejects(true)
      } else {
        resolve(false)
      }
    })
  })
}

const promiseMkdir = (dirnameHead, dirnameTail) => {
  return new Promise((resolve, rejects) => {
    fs.mkdir(`${__dirname}/../src/${dirnameHead}/`, (msg) => rejects(msg));
    fs.mkdir(`${__dirname}/../src/${dirnameHead}/${dirnameTail}`, (msg) => rejects(msg));
    resolve(true)
  })
}

const saveFile = (dirnameHead, dirnameTail, file, fileName) => {
  return new Promise((resolve, rejects) => {
    setTimeout(() => {
      file.mv(`${__dirname}/../src/${dirnameHead}/${dirnameTail}/${fileName}`, err => {
        if(err) rejects(err)
        else {
          resolve(`${__dirname}/../src/${dirnameHead}/${dirnameTail}/${fileName}`)
        }
      })
    }, 100);
  })
}

app.post('/api/questions/ask/image', fileUpload(), async (req, res) => {
  const name = (Object.keys(req.files)[0])
  const file = req.files[name]
  console.log(file.name)
  const dirnameHead = file.name.slice(0, file.name.length - 13)
  const dirnameTail = file.name.slice(-13)
  file.name = dirnameHead + Date.now() + ".png"

  let dataUrl = ''

  try{
    await promiseReaddir(dirnameHead, dirnameTail)
  } catch (e) {
    await promiseMkdir(dirnameHead, dirnameTail)
  }

  dataUrl = await saveFile(dirnameHead, dirnameTail, file, file.name)
  dataUrl = dataUrl.slice(38)
  res.send(dataUrl)
})

app.post('/api/questions/vote/:qid', async (req, res) => {
  const Question_id = req.params.qid
  const { User_id, Vote } = req.body

  const getVote = `SELECT COUNT(Vote_id) FROM Vote WHERE Vote_Userid='${User_id}' AND Vote_Qid=${Question_id}`
  const getVoteData = await runQuery.fetchData(getVote)

  if(getVoteData[0]['COUNT(Vote_id)']) {
    const updateVoteSql = `UPDATE Vote SET Vote_target_type='${Vote}' WHERE Vote_Userid='${User_id}' AND Vote_Qid=${Question_id}`
    const updateVoteData = await runQuery.fetchData(updateVoteSql)
    res.json(updateVoteData)
  } else {
    const tryVoteSql = `INSERT INTO Vote(Vote_target_type, Vote_Userid, Vote_Qid) VALUES('${Vote}', '${User_id}', ${Question_id})`
    const tryVoteData = await runQuery.fetchData(tryVoteSql)
    res.json(tryVoteData)
  }

})

app.get('/api/questions', async (req, res) => {
  const page = req.query.page || 0
  const pagesize = req.query.pagesize || 15

  const getQuestionsSql = `SELECT Question_id, Question_title, Question_content, Question_createdAt, User_nickname, Question_views, (SELECT GROUP_CONCAT(Vote_target_type) FROM Vote WHERE Vote_Qid=Question_id) AS Vote, (SELECT GROUP_CONCAT(Answer_id) FROM Answer WHERE Answer_Qid=Question_id) AS Answer FROM Questions LEFT JOIN Users ON Questions.Question_UserId = Users.User_id ORDER BY Question_id DESC LIMIT ${pagesize || 15} OFFSET ${(page === 0 ? 0 : page - 1) * pagesize || 0}`
  const getQuestionsData = await runQuery.fetchData(getQuestionsSql)
  const getTotalQuestionsSql = `SELECT COUNT(*) AS Total_questions FROM Questions`
  const getTotalQuestionsData = await runQuery.fetchData(getTotalQuestionsSql)

  getQuestionsData.forEach((e) => {
    if(e.Vote) {
      const data = e.Vote.split(',')
      e.Vote = data.reduce((acc, cur) => {
        return acc + Number(cur)
      }, 0)
    } else {
      e.Vote = 0
    }
    if(e.Answer) {
      const data = e.Answer.split(',')
      const count = data.length
      e.Answer = count
    } else {
      e.Answer = 0
    }
  })

  res.json([...getTotalQuestionsData, ...getQuestionsData])
})

app.get('/api/questions/:qid', async (req, res) => {
  const Question_id = req.params.qid
  const answerdSql = `SELECT Answer_id, Answer_content, Answer_createdAt, User_nickname FROM Answer LEFT JOIN Users ON Answer.Answer_UserId = Users.User_id WHERE Answer_Qid=${Question_id}`
  const commentSql = `SELECT Comment_id, Comment_UserId, Comment_content, Comment_createdAt, User_nickname FROM Comment LEFT JOIN Users ON Comment.Comment_UserId = Users.User_id WHERE Comment_Qid=${Question_id}`
  const voteSql = `SELECT Vote_target_type, Vote_Userid FROM Vote WHERE Vote_Qid=${Question_id}`
  const resData = {}

  resData.answer = await runQuery.fetchData(answerdSql)
  resData.comment = await runQuery.fetchData(commentSql)
  resData.vote = await runQuery.fetchData(voteSql)

  res.json(resData)
})

app.patch('/api/questions/:qid', async (req, res) => {
  const Question_id = req.params.qid
  const checkViewSql = `SELECT Question_views FROM Questions WHERE Question_id=${Question_id}`
  const views = await runQuery.fetchData(checkViewSql)
  const viewsSql = `UPDATE Questions SET Question_views=${++views[0].Question_views} WHERE Question_id=${Question_id}`
  await runQuery.fetchData(viewsSql)

  res.json({state: true, msg: "OK"})
})

app.post('/api/user/signup', async (req, res) => {
  const body = req.body
  const postSql = `INSERT INTO Users(User_id, User_password, User_nickname, User_email) VALUES('${body.User_id}', SHA2('${body.User_password}', 256), '${body.User_id}', '${body.User_email}')`
  const checkIdSql = `SELECT COUNT(User_id) AS checkID FROM Users WHERE User_id='${body.User_id}'`
  const checkEmailSql = `SELECT COUNT(User_email) AS checkEmail FROM Users WHERE User_email='${body.User_email}'`
  const checkIdResData = await runQuery.fetchData(checkIdSql)
  const checkEmailData = await runQuery.fetchData(checkEmailSql)
  let resData = {}

  if(checkIdResData[0]['checkID']) {
    resData = {
      ...resData,
      state: false,
      errIdMsg: 'Overlap User_ID'
    }
  }
  if(checkEmailData[0]['checkEmail']) {
    resData = {
      ...resData,
      state: false,
      errEmailMsg: 'Overlap User_Email'
    }
  } 
  if(!checkIdResData[0]['checkID'] && !checkEmailData[0]['checkEmail']){
    await runQuery.fetchData(postSql)
    resData = {
      ...resData,
      state: true,
      msg: 'OK', 
      User_id: body.User_id
    }
  }

  res.json(resData)
})

app.post('/api/user/login', async (req, res) => {
  const body = req.body
  const sql = `SELECT * FROM Users WHERE User_email='${body.User_email}' AND User_password=SHA2('${body.User_password}', 256)`
  const checkLoginData = await runQuery.fetchData(sql)
  
  if(checkLoginData.length === 0){
    res.json({state: false, msg: 'No Match ID or Password'})
  } else {
    const cookieOptions = {
      // domain: 'https://8it.kro.kr', 
      // Path: '/', 
      httpOnly: true, 
      secure: true, 
      sameSite: 'none'
    }

    const userData = {
      state: true,
      msg: 'OK',
      User_id: checkLoginData[0].User_id,
      User_nickname: checkLoginData[0].User_nickname,
      User_email: checkLoginData[0].User_email
    }

    const resData = await generateToken(userData)
    res.cookie('access_jwt', resData.accessToken, cookieOptions)
    res.json(userData)
  }
})

app.get('/api/user/checklogin', async (req, res) => {
  const verifyData = await verifyToken('access', req.cookies.access_jwt)
  if(verifyData){
    res.json({...verifyData, state: true, msg: "OK"})
  } else {
    res.json({state: false, msg: 'The token does not exist or has expired.'})
  }
})

try {
  const option = {
    ca: fs.readFileSync(`${process.env.SSL_PATH}/fullchain.pem`),
    key: fs.readFileSync(path.resolve(process.cwd(), `${process.env.SSL_PATH}/privkey.pem`), 'utf8').toString(),
    cert: fs.readFileSync(path.resolve(process.cwd(), `${process.env.SSL_PATH}/cert.pem`), 'utf8').toString(),
  };

  HTTPS.createServer(option, app).listen(port, () => {
    console.log(`[HTTPS] Soda Server is started on port ${port}`);
  });
} catch (error) {
  console.log('[HTTPS] HTTPS 오류가 발생하였습니다. HTTPS 서버는 실행되지 않습니다.');
  app.listen(port, () => {
    console.log(`[HTTP] Soda Server is started on port ${port}`);
  })
}
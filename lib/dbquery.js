// database
const mysql = require('mysql')
const dbconfig = require('../config/database.js')
const connection = mysql.createConnection(dbconfig)

const runQuery = {
  fetchData: (sql) => {
    return new Promise((resolve, reject) => {
      connection.query(sql, (err, rows) => {
        if(err) reject(err)
        else resolve(rows)
      })
    })
  },
}

module.exports = runQuery;
#!/usr/local/bin/nodejs

let net = require('net')
const conf = require('../config/myhome.json')

const serverAddress = conf.host
const serverPort = conf.port

const actions = {'on': 1, 'off': 0}
const kinds = {'light': 1, 'gen': 0}



console.log(serverAddress + ":" + serverPort)


function send(kind, action, pladdress) {
  console.log(kind)
  let message =  "*" + kinds[kind] + "*" + actions[action] + "*" + conf.lights[pladdress] + "##"
  console.log(message)
  sendMessage(serverAddress, serverPort, message)
}

function sendMessage(host, port, message) {
  const socket = new net.Socket()
  let responses = []

  // Send message after connection
  socket.connect({port, host}, () => {
      socket.end(message)
  })
}

module.exports = {send}
// send('*1*1*13##')
// send('*1*0*13##')
// send('*1*1*13##')
// send('*1*0*13##')
// send('*1*1*13##')
// send('*1*0*13##')
/* ___________________________________________________________________________

  Module: bot.js   Version: v0.0.1
  Repository: http://github.com/GuillermoPena/private-telegram-bot
  Author: Guillermo Peña (guillermo.pena.cardano@gmail.com)
  Last update: 07/07/2015

  Bot Manager: create bot, filter and response messages...

____________________________________________________________________________*/

function Bot(cfgPath){

  // ___ Modules ___________________________________________________________

  var cm = require('jsonfile-config-manager')         // Config Manager object
  var commandManager = require('./commandmanager.js') // Command Manager object
  var telegramBotAPI = require('telegram-bot-api')    // Telegram Bot API object
  var easyLogger = require('easylogger')              // Logger Manager Library
  var contains = require("multiple-contains")         // Contains library
  var path = require('path')                          // Path library

  // __ Constants __________________________________________________________

  const ownerCommands = ['adduser', 'removeusers']

  // __ Properties _________________________________________________________

  var tba     // Telegram Bot API object
  var cmm     // Command Manager
  var logger  // Winston Logger
  var lastMsg // Last message id

  // __ Private Methods ____________________________________________________

  // Build Bot
  var buildBot = function(args) {

    // Removing listeners if we are REbuilding bot
    if (tba) tba.removeAllListeners('message')

    // Building bot and retrieving bot info
    tba = new telegramBotAPI(cm.config.bot)
    tba.getMe(function(err, data) {
      if (err) logger.printError(err)
      else {
        tba.username = data.username
        tba.firstname = data.first_name
        logger.print('info', tba.firstname + " ... OK")

        // Receiving messages
        tba.on('message', function(message){
          filterMessages(message)
        })
        logger.print('info', tba.firstname + " listening ...")
        cmm = new commandManager(tba, logger, './config/')
      }
    })
  }

  // Format message to be logged
  var prepareMessage = function(message, to) {

    var messageToLog = "[msg_" + message.message_id + "] @" + message.from.username
    messageToLog += (to) ? " > @" + to + " : " : " : "
    if (message.text) {
      message.text = message.text.replace('\n','\n' + messageToLog)
      messageToLog += message.text
    }

    return messageToLog
  }

  // Send literal errors or messages in bot language
  var sendLiteral = function(message, response, language) {

    // Getting literal
    if (!language) language = cm.config.bot.defaultLanguage
    var literal = cm.config.literals[language][response]

    // Replacing variables
    literal = literal.replace(new RegExp('%username%'), message.from.username )
    literal = literal.replace(new RegExp('%botname%'), tba.firstname )

    // Sending response
    var params = { "chat_id": message.chat.id, "text": literal }
    var response = tba.sendMessage(params, logger.printBotError)
  }

  // Filtering Messages
  var filterMessages = function(message) {

    // Formating message and preparing variables
    //if (lastMsg >= message.message_id) return  // Avoiding repeat messages
    var username = message.from.username
    var messageToLog = prepareMessage(message)
    var responseNoAuthorizedMessages = cm.config.bot.responseNoAuthorizedMessages

    // Checking message
    var isFromOwner = (username == cm.config.bot.owner)
    var isFromUser = contains(cm.config.users, username, 'exists')
    var isCommand = (message.text && message.text.charAt(0) == '/')
    var activeUser = cmm.getActiveUserIdx(username)

    // Parsing command
    var slices = message.text.split(' ')
    var command = (isCommand) ? slices[0].replace("/","") : null
    var args = (isCommand && slices.length > 1) ? slices.slice(1, slices.length - 1) : null

    // Filter: No Authorized Messages
    if ( !isFromOwner && !isFromUser ) {
      if (responseNoAuthorizedMessages) {
        logger.print('info', messageToLog)
        sendLiteral(message, "notAuthorizedUserError")
      }
      return
    }

    // If command require cancel current operation
    if (command == "cancel") {
      logger.print('info', messageToLog)
      if (activeUser > -1) {
        cmm.removeActiveUser(username)
        sendLiteral(message, "operationCancelledError")
      } else {
        sendLiteral(message, "nothingToCancelError")
      }
      return
    }

    // Active user, has a command in progress...
    if (activeUser > -1) {
      cmm.sendToChild(username, message.text)
      logger.print('info', messageToLog)
      return
    }

    // Filter: No commands (First char must be '/')
    if (!isCommand) {
      logger.print('info', messageToLog)
      sendLiteral(message, "notCommandError")
      return
    }

    // Filter: Start command == Welcome message
    if (command == 'start') {
      logger.print('info', messageToLog)
      sendLiteral(message, "wellcomeMessage")
      return
    }

    // Filter: Unknown commands
    var isPublicCommand = cmm.isPublicCommand(command)
    var isAdminCommand = cmm.isAdminCommand(command)
    if (!isPublicCommand && !isAdminCommand) {
      logger.print('info', messageToLog)
      sendLiteral(message, "unknownCommandError")
      return
    }

    // Filter: No Authorized User
    if (isAdminCommand && !isFromOwner){
      logger.print('info', messageToLog)
      sendLiteral(message, "commandOnlyForOwnerError")
      return
    }

    // Running Known command
    lastMsg = message.message_id
    var scriptPath = (isPublicCommand) ? cmm.publicScriptsPath : cmm.adminScriptsPath
    cmm.run(message, path.join(scriptPath, command), args)
    logger.print('info', messageToLog)
    return
  }

  // __ Main _______________________________________________________________

  // Building logger
  logger = new easyLogger(cfgPath + 'logger.json')
  logger.printBotError = function(err, data) {

    // Preparing message to be log
    var to = (err) ? null : data.chat.username
    var message = (err) ? prepareMessage(err, to) : prepareMessage(data, to)
    var level = (err) ? 'error' : 'info'

    // Logging...
    logger.print(level, message)
  }

  // Loading config
  cm.addFile(cfgPath + 'literals.json', null, true)
  cm.addFile(cfgPath + 'users.json', null, true)
  cm.addFile(cfgPath + 'bot.json', null, true, buildBot)
}

module.exports = Bot
# connect-node
All nodejs artifacts related to the Connect project.

## Description
It is a simple and JSON library for node.js services to print out log in JSON format for elastic search.

Initial logger:
```js
const logger = require('connect-node').createLogger({appName: 'dashboard'}); // appName is required
logger.info('hello, clearpoint-connect!');
```

## Installation Instructions
```sh
$ npm install connect-node
```

## Logger Level
trace, debug, info, warn and error

## Logger API
```js
logger.log(LOG_LEVEL, MESSAGE, PAYLOAD); // LOG_LEVEL must be string
logger.trace( MESSAGE, PAYLOAD); // The MESSAGE(first) field is required, the second field can be optional
logger.debug( MESSAGE, PAYLOAD);
logger.info( MESSAGE, PAYLOAD);
logger.warn( MESSAGE, PAYLOAD);
logger.error( MESSAGE, PAYLOAD);
```
Example 1:
```js
logger.trace('hello, clearpoint-connect!');
````
Output will be like:
```js
{
	"appName":"dashboard",
	"priority":"REST",
	"message":"hello, clearpoint-connect!"
}
```

Example 2:
```js
logger.log('VERBOSE', 'hello, clearpoint-connect!');
````
Output will be like:
```js
{
	"appName":"dashboard",
	"priority":"VERBOSE",
	"message":"hello, clearpoint-connect!"
}
```

Example 3:
```js
logger.trace('Send POST request', {url: 'https://www.google.com', method: 'POST', status: 200});
````
Output will be like:
```js
{
	"appName":"dashboard",
	"priority":"REST",
	"message":"Send POST request",
	"payload":"{\"status\":200,\"url\":\"https://www.google.com\",\"method\":\"POST\"}"
}
```

![connect](http://website.clearpoint.co.nz/connect/connect-logo-on-white-border.png)

[Connect](http://connect.cd) is a Continuous Delivery Platform that gathers best practice approaches for deploying working software into the cloud with confidence.

The main documentation for [Connect](http://connect.cd) can be found at [docs.connect.cd](http://docs.connect.cd)

Any queries on the [Connect](http://connect.cd) platform can be sent to: connect@clearpoint.co.nz

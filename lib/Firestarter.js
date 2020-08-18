let Communication = require('./Communication')
const opentracing = require('opentracing')
const TracerFactory = require('./Tracer')
let Fire = require('./Fire')

let Assigner = require('assign.js')
let assigner = new Assigner()

let _ = require('isa.js')
let Proback = require('proback.js')

let { OK, SEPARATOR } = require('./Static')

const GLOBAL_TERMS = '*'

/**
* Firestarter is an abstract type to define a wrapper for listeners
*
* @class Firestarter
* @constructor
*/
function Firestarter ( ) {}

let firestarter = Firestarter.prototype

firestarter.initTracer = function (tracer, name, logger) {
	logger.info(`Initializing tracer for ${name}`)
	this.tracer = TracerFactory(tracer, name, logger)
}

firestarter.addTerms = function (externalID, terms) {
	if ( externalID && terms && !this.terms[ externalID ] )
		this.terms[ externalID ] = terms
}

/**
* Sets the Blwer object for this firestarter instance
*/
firestarter.setBlower = function ( blower ) {
	this.blower = blower
}


/**
* Retrieves the array of events it is listening
*/
firestarter.services = function ( ) {
	throw new Error('To be implemented...')
}

firestarter.parameters = function ( service ) {
	throw new Error('To be implemented...')
}

/**
* Validates division of an incoming message
*/
firestarter.sameDivision = function ( division ) {
	let div = division || ''

	if ( div === '*' )
		return true

	if ( !this.divisionPath )
		this.divisionPath = this.division.split( SEPARATOR )

	let dPath = div.split( SEPARATOR ), i = 0
	for ( i = 0; i < this.divisionPath.length; i += 1 ) {
		if ( i >= dPath.length || (this.divisionPath[i] && this.divisionPath[i] !== dPath[i]) ) return false
	}
	return true
}

/**
* Matches the emited respose event with the interest of the entity encapsulated by this firestarter
*
* @method matchesRespose
* @param {Communication} comm The communication object
* @return {Boolean} Returns true on matching
*/
firestarter.matchesRespose = function ( comm ) {
	return (comm.source === this.name && comm.sourceDivision === this.division) && this.blower.known( comm.originalId )
}


/**
* Matches the emited event with the interest of the entity encapsulated by this firestarter
*
* @method matches
* @param {Communication} comm The communication object
* @return {Boolean} Returns true on matching
*/
firestarter.matches = function ( comm ) {
	throw new Error('To be implemented...')
}

function responseAsArray ( responseComms, attribute ) {
	let res = responseComms.map( function (responseComm) { return responseComm[attribute || 'response'] } ).filter( function (resp) { return (typeof (resp) !== 'undefined' && resp !== null) })
	return res.length === 0 ? null : res
}
/*
function responseAsObject ( responseComms ) {
	let res = responseComms.map( function (responseComm) { return responseComm.response } ).filter( function (resp) { return resp })
	return res.length === 0 ? null : res
}
*/
function mapValues ( object, converter ) {
	let result = {}

	for ( let key in object )
		result[key] = converter( object[key] )

	return result
}

function indexBy ( array, attributeName ) {
	let result = {}

	array.forEach( function (object) {
		if ( object[ attributeName ] )
			result[ object[ attributeName ] ] = object
	} )

	return result
}

/**
* Conformise the response comm objects
*
* @method conformResponse
* @param {Communication} responseComms Response array containing Communication objects
* @return {Object} Return response
*/
firestarter.conformResponse = function ( error, responseComms ) {
	if ( error ) return { err: error, res: null }

	let err, res

	if ( Array.isArray(responseComms) ) {
		err = responseAsArray( responseComms, 'error' )
		if ( this.config.namedResponses ) {
			let indexed = indexBy(responseComms, 'responder')
			if ( err ) {
				err = new Fire( mapValues( indexed, function ( response ) {
					return response.error
				}) )
			}
			res = mapValues( indexed, function ( response ) {
				return response.response
			})
		}
		else {
			res = responseAsArray( responseComms, 'response' )
		}
	}
	else {
		err = responseComms.error
		res = responseComms.response
	}
	return { err: err, res: res }
}

/**
* Transfers a response event to the source
*
* @method appease
* @param {Communication} comm Communication response object to deliver
*/
firestarter.appease = async function ( error, comm, responseComms ) {
	let self = this

	let bcomm = self.blower.comm( comm.id )
	if ( bcomm ) {
		if ( !self.concealed )
			self.logger.harconlog(null, 'Appease', comm.shallow( error, responseComms ), 'trace' )

		let response = self.conformResponse( error, responseComms )
		if ( !response.err && (typeof (response.res) === 'undefined' || response.res === null) ) response.err = new Error('Service returned without a value: ' + comm.event )
		self.blower.burnout( comm.id )
		if ( bcomm.callback )
			bcomm.callback( response.err, (!response.err && self.barrel.unfoldAnswer && response.res.length === 1) ? response.res[0] : response.res )
	}
	return OK
}

firestarter.getServiceInfo = async function ( comm ) {
	throw new Error('To be implemented...')
}

/**
* Distpaches the emited event to the listener
*
* @method burn
* @param {Communication} comm The communication object representing the event emited.
*/
firestarter.burn = async function ( comm ) {
	let self = this
	return new Promise( async (resolve, reject) => {
		if ( !self.concealed )
			self.logger.harconlog(null, 'Burning', comm.shallow(), 'trace' )

		let serviceInfo = await self.getServiceInfo( comm )

		let serviceFn = serviceInfo.service

		let isTraceable = serviceInfo.params.includes('terms')
		if (isTraceable) {
			console.log('>>>>>>>>>>>>>>>> burn', serviceInfo)
		}

		let callbackFn = function (err, res) {
			if ( comm.externalId && self.terms[ comm.externalId ] )
				delete self.terms[ comm.externalId ]
			if (err) reject(err)
			else resolve( comm.twist(self.name, self.barrel.nodeID, err, res) )
		}
		/*
		if ( !serviceInfo.vargs && serviceInfo.params.length !== comm.params.length )
			return callbackFn( new Error('Mind the parameter list! You have sent ' + comm.params.length + ' instead of ' + serviceInfo.params.length + ' for ' + self.name + '.' + comm.event ) )
		*/
		comm.terms = comm.terms || {}
		let terms = assigner.cloneObject( comm.terms )
		terms.sourceComm = comm.shallow()

		function extendComm () {
			for (let attribute in terms)
				if ( terms.hasOwnProperty( attribute ) && !comm.terms.hasOwnProperty(attribute) )
					comm.terms[attribute] = terms[attribute]
			return comm
		}

		let requestFn = self.auditor ? function ( ...parameters ) {
			return self.burst( extendComm(), Communication.MODE_REQUEST, parameters )
		} : function ( ...parameters ) {
			let args = [ null, null, self.division ].concat( parameters )
			return self.burst( extendComm(), Communication.MODE_REQUEST, args )
		}
		let informFn = self.auditor ? function ( ...parameters ) {
			return self.burst( extendComm(), Communication.MODE_INFORM, parameters )
		} : function ( ...parameters ) {
			let args = [ null, null, self.division ].concat( parameters )
			return self.burst( extendComm(), Communication.MODE_INFORM, args )
		}
		let delegateFn = self.auditor ? function ( ...parameters ) {
			return self.burst( extendComm(), Communication.MODE_DELEGATE, parameters )
		} : function ( ...parameters ) {
			let args = [ null, null, self.division ].concat( parameters )
			return self.burst( extendComm(), Communication.MODE_DELEGATE, args )
		}

		terms.inform = informFn
		terms.delegate = delegateFn
		terms.request = requestFn

		let params = serviceInfo.vargs
			? [].concat( terms ).concat( comm.params )
			: [].concat( comm.params ).concat( terms )
		try {
			let span
			if (self.tracer && isTraceable) {
				let parentSpan = self.tracer.extract(opentracing.FORMAT_TEXT_MAP, terms)
				span = self.tracer.startSpan(serviceFn.name, { childOf: parentSpan})
				span.setTag('division', terms.sourceComm.division)
				span.setTag('event', terms.sourceComm.event)
				span.setTag('flowID', terms.sourceComm.flowId)
				span.setTag('originalID', terms.sourceComm.originalId)
				self.tracer.inject(span, opentracing.FORMAT_TEXT_MAP, comm.terms)
			}
			let res = await serviceFn.apply( self.object || { comm: comm, terms: terms }, params )
			if (span) {
				span.finish()
			}
			callbackFn( null, res )
		} catch ( err ) { callbackFn(err) }
	} )
}

/**
* Distpaches the burst event to be emited within the flow of a previous event
*
* @method burst
* @param {Communication} comm The communication object representing the event to be emited.
* @param {Array} params Parameters associatd with the communication to send with
*/
firestarter.burst = async function ( comm, mode, params ) {
	let self = this
	let externalID = params[ 0 ]
	let flowID = params[ 1 ]
	let division = params[ 2 ] || self.division
	let event = params[ 3 ]
	let callParams = params.slice( 4, params.length )

	console.log('>>>>>>>>>>>>>>>> burst', comm.flowId, event)

	if (self.config.bender && self.config.bender.enabled && self.config.bender.forced && self.config.bender.privileged.indexOf(self.name) === -1 ) {
		// division, event, parameters
		let _division = self.config.division
		let _event = 'FireBender.exec'
		let _callParams = [ division, event, callParams ]

		division = _division
		event = _event
		callParams = _callParams
	}

	let isRequest = mode === Communication.MODE_REQUEST

	return new Promise( async function (resolve, reject) {
		let newComm = comm.burst( externalID, flowID, self.division, self.name, self.barrel.nodeID, division, event, callParams, isRequest ? Proback.handler(null, resolve, reject) : null )

		self.logger.harconlog( null, 'Igniting', {newComm: newComm.shallow(), comm: comm.shallow()}, 'trace' )

		self.blower.blow( newComm )

		try {
			let span
			// if (self.tracer) {
			// 	let parentSpan = self.tracer.extract(opentracing.FORMAT_TEXT_MAP, comm.terms)
			// 	span = self.tracer.startSpan('burst', { childOf: parentSpan })
			// 	self.tracer.inject(span, opentracing.FORMAT_TEXT_MAP, newComm.terms)
			// }
			await self.barrel.intoxicate( newComm )
			if (span) {
				span.finish()
			}
			if ( !isRequest )
				resolve('ok')
		} catch (err) { reject(err) }
	} )
}

firestarter.innerIgnite = async function ( ...parameters ) {
	let self = this
	let mode = parameters[ 0 ]
	let externalId = parameters[ 1 ]
	let flowId = parameters[ 2 ]
	let division = parameters[ 3 ] || self.division
	let event = parameters[ 4 ]
	let params = parameters.slice( 5, parameters.length )

	let isTraceable = flowId !== null

	if (self.config.bender && self.config.bender.enabled && self.config.bender.forced && self.config.bender.privileged.indexOf(self.name) === -1 ) {
		// division, event, parameters
		let _division = self.config.division
		let _event = 'FireBender.exec'
		let _params = [ division, event, params ]

		division = _division
		event = _event
		params = _params
	}

	let isRequest = mode === Communication.MODE_REQUEST

	return new Promise( async function (resolve, reject) {
		let comm = Communication.newCommunication( mode, null, flowId, externalId, self.division, self.name, self.barrel.nodeID, division, event, params, isRequest ? Proback.handler(null, resolve, reject) : null )

		if ( self.terms[ GLOBAL_TERMS ] )
			comm.terms = self.terms[ GLOBAL_TERMS ]

		if ( externalId && self.terms[externalId] ) {
			assigner.assign( comm.terms, self.terms[externalId] )
			// comm.terms = self.terms[externalId]
			// delete self.terms[externalId]
		}
		self.logger.harconlog(null, 'Initiate ignition', {comm: comm.shallow()}, 'trace' )
		if (isTraceable) {
			self.tracer.inject(self.span, opentracing.FORMAT_TEXT_MAP, comm.terms)
		}

		self.blower.blow( comm )
		try {
			await self.barrel.intoxicate( comm )
			if ( !isRequest ) {
				resolve('ok')
			}
		} catch (err) { reject(err) }
	} )
}

/**
* Distpaches the new event to be emited
*
* @method ignite
* @param varargs defining attributes of a communication: eventName [list of parameters]
*/
firestarter.ignite = async function ( ...params ) {
	let event = params[ 4 ]
	let flowId = params[ 2 ]
	let isTraceable = flowId !== null
	if (isTraceable)
		console.log('>>>>>>>>>>>>>>>> ignite', flowId, event)
	if ( _.isString(event) ) {
		let span
		if (this.tracer && isTraceable) {
			span = this.tracer.startSpan('ignite')
			span.setTag('flowID', flowId)
			span.setTag('event', event)
		}
		// eslint-disable-next-line
		let resp = await this.innerIgnite.call(Object.assign({}, this, {span}), ...params )
		if (span) {
			span.finish()
		}
		return resp
	}

	if ( Array.isArray(event) ) {
		let promises = []
		for (let ev of event) {
			params[4] = ev
			promises.push( this.innerIgnite( ...params ) )
		}
		return Promise.all( promises )
	}

	throw new Error( 'Invalid parameters' )
}

firestarter.close = async function ( ) {
	if (this.blower)
		await this.blower.close()

	if (this.tracer) {
		this.tracer.close()
	}

	return OK
}

module.exports = Firestarter

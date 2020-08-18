let Firestarter = require('./Firestarter')

let _ = require('isa.js')

let Cerobee = require('clerobee')
let clerobee = new Cerobee( 16 )

let path = require('path')

let Assigner = require('assign.js')
let assigner = new Assigner().respect( false )

let { SEPARATOR } = require('./Static')

function distinguishPostfix ( distinguish ) {
	if (!distinguish) return ''

	return _.isBoolean( distinguish ) ? clerobee.generate() : distinguish
}

function isLast (array, value, defaultValue) {
	if ( array.length === 0 ) return false

	let element = array.pop()
	let found = Array.isArray(value) ? value.indexOf(element) > -1 : element === value
	if ( !found )
		array.push( element )
	return found || defaultValue
}

let { functions } = require( '../util/Extender' )

/**
* Firestormstarter is a wrapper for listener object where its functions are the listeners routed by its 'context' property
*
* @class Firestormstarter
* @constructor
*/
function Firestormstarter ( config, barrel, object, blower, logger ) {
	this.config = config || {}

	this.division = object.division || config.division || ''


	this.auditor = object.auditor

	this.concealed = object.concealed
	this.systemEntity = !!object.systemEntity

	this.name = object.name || 'Unknown flames'
	this.distinguishedName = this.name + distinguishPostfix( object.distinguish )

	this.active = true

	this.context = object.context || ''

	this.path = this.context.split( SEPARATOR )
	this.pathLength = this.path.length



	this.barrel = barrel
	this.object = object

	this.logger = logger
	this.blower = blower

	this.cronjobRefs = {}
	this.timeoutRefs = []
	this.intervalRefs = []
	this.object = require('../util/Extender').extend( this, this.object, path.join( __dirname, 'ext' ) )

	this._events = functions( object )

	this._serviceInfo = []
	for (let i = 0; i < this._events.length; ++i) {
		let service = this._events[i]
		let params = _.parameterNames( object[ service ] )
		this._serviceInfo[ service ] = {
			vargs: isLast(params, '...args'),
			params: params
		}
	}

	this.object.harconlog = logger.harconlog

	this.terms = object.terms || {}
	this.initTracer(this.config.tracer, this.name, this.logger)
}

Firestormstarter.prototype = new Firestarter()

let firestorm = Firestormstarter.prototype

firestorm.services = function ( ) {
	return this._events
}

firestorm.parameters = function ( service ) {
	return this._serviceInfo[ service ].params
}

firestorm.matches = function ( comm ) {
	if ( !comm.event || !this.sameDivision( comm.division ) ) return false

	let index = comm.event.lastIndexOf( SEPARATOR )
	let prefix = comm.event.substring(0, index)
	let fnName = comm.event.substring(index + 1)

	let matches = fnName && this._events.includes( fnName )

	if ( matches && this.name !== prefix && this.distinguishedName !== prefix ) {
		let eventPath = index === -1 ? [] : prefix.split( SEPARATOR ), len = eventPath.length
		for (let i = 0; i < len && i < this.pathLength; i += 1)
			if ( this.path[i] !== eventPath[i] ) {
				matches = false
				break
			}
	}

	this.logger.harconlog( null, 'Matching', { events: this._events, eventName: comm.event, matches: matches }, 'trace' )

	return matches
}

firestorm.getServiceInfo = async function ( comm ) {
	let self = this

	let index = comm.event.lastIndexOf( SEPARATOR )
	let eventName = comm.event.substring( index + 1 )

	let copy = assigner.copyObject( this._serviceInfo[ eventName ] )
	copy.service = this.object[ eventName ]

	if ( this.object.supervener ) {
		let entitySV = await this.barrel.inflicter.entity( this.object.supervener )
		if ( !entitySV || !entitySV.supervene || !entitySV.superform )
			throw new Error( `No proper supervener entity found for ${this.object.supervener}` )

		copy._service = copy.service
		copy.service = async ( ...attributes ) => {
			let realParams = await entitySV.supervene( comm.event, ...attributes )
			let res = await copy._service.apply( self.object, realParams )
			let realRes = await entitySV.superform( comm.event, res )
			return realRes
		}
	}

	return copy
}

firestorm.close = async function ( ) {
	var self = this

	if (this.blower)
		await this.blower.close()

	for (let name in self.cronjobRefs) {
		try {
			self.cronjobRefs[name].stop()
		} catch ( err ) { self.harconlog(err) }
	}
	self.cronjobRefs = {}

	for (let ref of self.timeoutRefs) {
		clearTimeout(ref)
	}
	self.timeoutRefs.length = 0

	for (let ref of self.intervalRefs) {
		clearInterval(ref)
	}
	self.intervalRefs.length = 0

	await self.object.close( )
	return 'closed'
}

module.exports = Firestormstarter

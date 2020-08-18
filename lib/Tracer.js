const opentracing = require('opentracing')

function TracerFactory (opts, serviceName, logger) {
	this.opts = opts

	if (!this.opts.tracerFactory) {
		return new opentracing.MockTracer()
	}

	if (!this.opts.options) {
		this.opts.options = {}
	}

	if (!this.opts.config) {
		this.opts.config = {}
	}

	this.opts.config.serviceName = serviceName

	if (logger) {
		this.opts.options.logger = logger
	}

	return this.opts.tracerFactory(this.opts.config, this.opts.options)

}

module.exports = TracerFactory

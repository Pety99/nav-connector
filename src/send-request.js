const xml2js = require('xml2js');
const { promisify } = require('util');
const { pick } = require('lodash');

const xmlParser = new xml2js.Parser({ explicitArray: false });
const parseXml = promisify(xmlParser.parseString).bind(xmlParser);

const createRequestXml = require('./create-request-xml.js');

/**
 * Convert request to xml and send to the given NAV service resource.
 * @async
 * @param {Object} params Function params.
 * @param {Object} params.request Request object for xml conversion and send.
 * @param {Object} params.axios Axios instance.
 * @param {string} params.path NAV service resource path.
 * @returns {Promise<Object>} Axios response data value.
 * @throws {Object} Normalized NAV service error response or network error.
 */
module.exports = async function sendRequest({ request, axios, path }) {
  try {
    const requestXml = createRequestXml(request);
    const response = await axios.post(path, requestXml);

    // [3.0] replace ns2 and ns3 in response to empty string because we can get responses with or without namespaces
    const noNsXml = response.data.replace(/ns2:|ns3:/g, '');

    response.data = await parseXml(noNsXml);
    return {...response.data, requestXml};
  } catch (error) {
    const { response } = error;
    /* Normalize errors. */
    if (response) {
      /* istanbul ignore next */
      if (!response.data) {
        response.data = {
          result: {},
          technicalValidationMessages: [],
        };
      } else if (response.data.includes('GeneralExceptionResponse')) {
        // [3.0] replace ns2 and ns3 in response to empty string because we can get responses with or without namespaces
        const noNsXml = response.data.replace(/ns2:|ns3:/g, '');

        const data = await parseXml(noNsXml);
        response.data = {
          result: pick(data.GeneralExceptionResponse, [
            'funcCode',
            'errorCode',
            'message',
          ]),
          technicalValidationMessages: [],
        };
      } else if (response.data.includes('GeneralErrorResponse')) {
        // [3.0] replace ns2 and ns3 in response to empty string because we can get responses with or without namespaces
        const noNsXml = response.data.replace(/ns2:|ns3:/g, '');

        const data = await parseXml(noNsXml);
        response.data = pick(data.GeneralErrorResponse, [
          'result',
          'schemaValidationMessages',
          'technicalValidationMessages',
        ]);

        const { technicalValidationMessages } = response.data;

        /* Normalize technicalValidationMessages to array. */
        if (!response.data.technicalValidationMessages) {
          response.data.technicalValidationMessages = [];
        } else if (!Array.isArray(technicalValidationMessages)) {
          response.data.technicalValidationMessages = [
            technicalValidationMessages,
          ];
        }
      } else {
        response.data = {
          result: {
            message: response.data,
          },
          technicalValidationMessages: [],
        };
      }
    }

    throw error;
  }
};

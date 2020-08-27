'use strict';
const fsModule = require('fs');
const inquirerModule = require('inquirer');

const serverConfigModule = require('../server/config');
const jsonLintModule = require('./json-lint');
const { DEFAULT_CUSTOM_LAYOUTS_CONFIG } = require("../constants");

class StencilInit {
    /**
     * @param inquirer
     * @param jsonLint
     * @param fs
     * @param serverConfig
     * @param logger
     */
    constructor ({
        inquirer = inquirerModule,
        jsonLint = jsonLintModule,
        fs = fsModule,
        serverConfig = serverConfigModule,
        logger = console,
    } = {}) {
        this.inquirer = inquirer;
        this.jsonLint = jsonLint;
        this.logger = logger;
        this.fs = fs;
        this.serverConfig = serverConfig;
    }

    /**
     * @param {string} dotStencilFilePath
     * @param {object} cliOptions
     * @param {string} cliOptions.url
     * @param {string} cliOptions.token
     * @param {number} cliOptions.port
     * @returns {Promise<void>}
     */
    async run (dotStencilFilePath, cliOptions = {}) {
        const oldStencilConfig = this.readStencilConfig(dotStencilFilePath);
        const defaultAnswers = this.getDefaultAnswers(oldStencilConfig, cliOptions);
        const answers = await this.askQuestions(defaultAnswers);
        const updatedStencilConfig = this.applyAnswers(oldStencilConfig, answers);
        this.saveStencilConfig(updatedStencilConfig, dotStencilFilePath);

        this.logger.log('You are now ready to go! To start developing, run $ ' + 'stencil start'.cyan);
    }

    /**
     * @param {string} dotStencilFilePath
     * @returns {object}
     */
    readStencilConfig (dotStencilFilePath) {
        if (this.fs.existsSync(dotStencilFilePath)) {
            const dotStencilFile = this.fs.readFileSync(dotStencilFilePath, { encoding: 'utf-8' });
            try {
                // We use jsonLint.parse instead of JSON.parse because jsonLint throws errors with better explanations what is wrong
                return this.jsonLint.parse(dotStencilFile, dotStencilFilePath);
            } catch (err) {
                this.logger.error(
                    'Detected a broken .stencil file:\n',
                    err,
                    '\nThe file will be rewritten with your answers',
                );
            }
        }

        return {};
    }

    /**
     * @param {{port: (number), normalStoreUrl: (string), accessToken: (string)}} stencilConfig
     * @param {{port: (number), url: (string), token: (string)}} cliOptions
     * @returns {{port: (number), normalStoreUrl: (string), accessToken: (string)}}
     */
    getDefaultAnswers (stencilConfig, cliOptions) {
        return {
            normalStoreUrl: cliOptions.url || stencilConfig.normalStoreUrl,
            accessToken: cliOptions.token || stencilConfig.accessToken,
            port: cliOptions.port || stencilConfig.port || this.serverConfig.get('/server/port'),
        };
    }

    /**
     * @param {{port: (number), normalStoreUrl: (string), accessToken: (string)}} defaultAnswers
     * @returns {Promise<object>}
     */
    async askQuestions (defaultAnswers) {
        return await this.inquirer.prompt([
            {
                type: 'input',
                name: 'normalStoreUrl',
                message: 'What is the URL of your store\'s home page?',
                validate: val => /^https?:\/\//.test(val) || 'You must enter a URL',
                default: defaultAnswers.normalStoreUrl,
            },
            {
                type: 'input',
                name: 'accessToken',
                message: 'What is your Stencil OAuth Access Token?',
                default: defaultAnswers.accessToken,
                filter: val => val.trim(),
            },
            {
                type: 'input',
                name: 'port',
                message: 'What port would you like to run the server on?',
                default: defaultAnswers.port,
                validate: val => {
                    if (isNaN(val)) {
                        return 'You must enter an integer';
                    } else if (val < 1024 || val > 65535) {
                        return 'The port number must be between 1025 and 65535';
                    } else {
                        return true;
                    }
                },
            },
        ]);
    }

    /**
     * @param {object} stencilConfig
     * @param {object} answers
     * @returns {object}
     */
    applyAnswers (stencilConfig, answers) {
        return {
            customLayouts: DEFAULT_CUSTOM_LAYOUTS_CONFIG,
            ...stencilConfig,
            ...answers,
        };
    }

    /**
     * @param {object} config
     * @param {string} path
     */
    saveStencilConfig (config, path) {
        this.fs.writeFileSync(path, JSON.stringify(config, null, 2));
    }
}

module.exports = StencilInit;

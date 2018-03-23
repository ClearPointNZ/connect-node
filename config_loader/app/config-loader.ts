

import * as minimist from 'minimist';
import * as jsYaml from 'js-yaml';
import * as fs from 'fs';
import * as _ from 'lodash';
import * as chokidar from 'chokidar';

let loadedProperties = undefined;

export interface ConfigurationPostProcessor {
    key(key, value: string, loadedProperties: any);
}

export class ConfigurationLoader {

    private propertyFiles: string[];
    private postProcessors: ConfigurationPostProcessor[];
    private objects: any[];


    public load() {

        loadedProperties = {};

        const args = minimist(process.argv.slice(2));

        if (args['p']) {
            this.propertyFiles = typeof args['p'] === 'string' ? [args['p']] : args['p'];
            this.loadProperties();

            // watch file changes and rewire
            chokidar.watch(this.propertyFiles, {ignoreInitial: true}).on('all', (event, path) => {
                loadedProperties = {};
                this.loadProperties();
            });
        }
    }

    private postProcess(cpp: ConfigurationPostProcessor) {
        Object.keys(loadedProperties).forEach(key => {
            cpp.key(key, loadedProperties[key], loadedProperties);
        });
    }

    public postProcessProperties(cpp: ConfigurationPostProcessor) {
        this.postProcessors.push(cpp);
    }

    private loadProperties() {
        for (const propertyFile of this.propertyFiles) {
            try {
                const additionalProperties = jsYaml.safeLoad(fs.readFileSync(propertyFile, 'utf8'));
                _.merge(loadedProperties, additionalProperties);
            } catch (e) {
                console.error('Error loading property file', propertyFile, e);
                process.exit();
            }
        }
    }

    private pushProperties(properties: { [index: string]: any }) {
        for (const property of Object.keys(properties)) {
            const value = properties[property];
            _.set(loadedProperties, property, value);
        }
    }

    public setProperties(fullObject: { [index: string]: any }) {
        this.objects.push(fullObject);
        this.pushProperties(fullObject);
    }
}

export const configLoader = new ConfigurationLoader();
configLoader.load();
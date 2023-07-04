"use strict";

const fs   = require("fs");
const glob = require("glob");
const os   = require("os");

module.exports = class Next2DWebpackTypeScriptAutoLoaderPlugin
{
    /**
     * @param {object} object
     * @param {object} [options=null]
     */
    constructor (object, options = null)
    {
        /**
         * @type {string}
         * @default local
         * @private
         */
        this._$env = object.environment;

        /**
         * @type {string}
         * @default web
         * @private
         */
        this._$platform = object.platform;

        /**
         * @type {Object}
         * @default null
         * @private
         */
        this._$options = options;

        /**
         * @type {string}
         * @private
         */
        this._$cacheJson = "";

        /**
         * @type {string}
         * @private
         */
        this._$cachePackages = "";
    }

    /**
     * @param   {Compiler} compiler
     * @returns {void}
     */
    apply (compiler)
    {

        compiler.hooks.beforeCompile.tapAsync("Next2DWebpackTypeScriptAutoLoaderPlugin", (compilation, callback) =>
        {
            this._$buildTypeScript(compilation.normalModuleFactory.context);
            callback();
        });

        const outputPath = compiler.options.output.path;
        if (compiler.options.mode === "production") {

            compiler.hooks.afterEmit.tap("Next2DWebpackTypeScriptAutoLoaderPlugin", () =>
            {
                glob(`${outputPath}/*`, (err, files) =>
                {
                    if (err) {
                        throw err;
                    }

                    const filename = compiler.options.output.filename;
                    files.forEach((file) =>
                    {
                        if (file.indexOf(filename) > -1
                            && !this._$options.LICENSE
                            && file.indexOf(`${filename}.LICENSE.txt`) > -1
                        ) {

                            fs.unlink(file, (err) => {
                                if (err) {
                                    throw err;
                                }
                            });

                        }
                    });
                });
            });
        }

        if (this._$env === "local"
            && !fs.existsSync(`${outputPath}/index.html`)
        ) {

            if (!fs.existsSync(`${outputPath}`)) {
                fs.mkdirSync(`${outputPath}`, { "recursive": true });
            }

            fs.writeFileSync(
                `${outputPath}/index.html`,
                `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>${this._$env}</title>
    <script src="./app.js"></script>
</head>
<body style="margin: 0; padding: 0;">
</body>
</html>`);

        }
    }

    /**
     * @param  {string} path
     * @return {string}
     */
    _$getFileType (path)
    {
        try {

            const stat = fs.statSync(path);

            switch (true) {
                case stat.isFile():
                    return "file";

                case stat.isDirectory():
                    return "directory";

                default:
                    return "unknown";
            }

        } catch (e) {

            return "unknown";

        }
    }

    /**
     * @param  {string} dir_path
     * @return {array}
     * @private
     */
    _$listFiles (dir_path)
    {
        const files = [];
        const paths = fs.readdirSync(dir_path);

        for (let idx = 0; idx < paths.length; ++idx) {

            const path = `${dir_path}/${paths[idx]}`;
            switch (this._$getFileType(path)) {

                case "file":
                    files.push(path);
                    break;

                case "directory":
                    files.push(...this._$listFiles(path));
                    break;

                default:
                    break;

            }
        }

        return files;
    }

    /**
     *
     * @param {string} dir
     * @private
     */
    _$buildTypeScript (dir)
    {
        const config = {
            "platform": this._$platform,
            "stage"  : {},
            "routing": {}
        };

        const configPath = `${dir}/src/config/config.json`;
        if (fs.existsSync(configPath)) {

            const envJson = JSON.parse(
                fs.readFileSync(configPath, { "encoding": "utf8" })
            );

            if (this._$env in envJson) {
                Object.assign(config, envJson[this._$env]);
            }

            if (envJson.all) {
                Object.assign(config, envJson.all);
            }
        }

        const stagePath = `${dir}/src/config/stage.json`;
        if (fs.existsSync(stagePath)) {

            const stageJson = JSON.parse(
                fs.readFileSync(stagePath, { "encoding": "utf8" })
            );

            Object.assign(config.stage, stageJson);
        }

        const routingPath = `${dir}/src/config/routing.json`;
        if (fs.existsSync(routingPath)) {

            const routingJson = JSON.parse(
                fs.readFileSync(routingPath, { "encoding": "utf8" })
            );

            Object.assign(config.routing, routingJson);
        }

        const json = JSON.stringify(config, null, 4);
        if (this._$cacheJson !== json) {
            // cache
            this._$cacheJson = json;

            fs.writeFileSync(
                `${dir}/src/config/Config.ts`,
                `import { ConfigImpl } from "@next2d/framework/dist/interface/ConfigImpl";
const config: ConfigImpl = ${JSON.stringify(config, null, 4)};
export { config };`
            );
        }

        const files  = this._$listFiles(`${dir}/src`);
        let imports  = "";
        let packages = `[${os.EOL}`;
        for (let idx = 0; idx < files.length; ++idx) {

            const file = files[idx];
            if (file.indexOf(".ts") === -1) {
                continue;
            }

            const js    = fs.readFileSync(file, { "encoding": "utf-8" });
            const lines = js.split("\n");

            const path = file.replace(`${dir}/`, "");
            for (let idx = 0; idx < lines.length; ++idx) {

                const line = lines[idx];
                if (line.indexOf("export class ") === -1) {
                    continue;
                }

                const name = line.split(" ")[2];
                switch (true) {

                    case path.indexOf("src/view/") > -1:
                        imports  += `import { ${name} } from "@/${path.split("src/")[1].split(".ts")[0]}";${os.EOL}`;
                        packages += `    ["${name}", ${name}],${os.EOL}`;
                        break;

                    case path.indexOf("src/model/") > -1:
                        {
                            const key = file
                                .split("src/model/")[1]
                                .split("/")
                                .join(".")
                                .slice(0, -3);

                            const asName = file
                                .split("src/model/")[1]
                                .split("/")
                                .join("_")
                                .slice(0, -3);

                            imports  += `import { ${name} as ${asName} } from "@/${path.split("src/")[1].split(".ts")[0]}";${os.EOL}`;
                            packages += `    ["${key}", ${asName}],${os.EOL}`;
                        }
                        break;

                    default:
                        break;

                }

                break;

            }
        }

        packages  = packages.slice(0, -2);
        packages += `${os.EOL}]`;

        const value = `${imports}
const packages: any[] = ${packages};
export { packages };`;

        if (this._$cachePackages !== value) {
            // cache
            this._$cachePackages = value;
            fs.writeFileSync(`${dir}/src/Packages.ts`, value);
        }
    }
};

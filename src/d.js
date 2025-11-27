class D {
    Port = 3000
    Config = {
        NodeEnv: "development"
    }
constructor() {
console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║             📊 Deploy Center Server Info               ║
║                                                        ║
╠════════════════════════════════════════════════════════╣
`);

console.table([
    { Key: "Port", Value: this.Port },
    { Key: "Environment", Value: this.Config.NodeEnv },
    { Key: "API", Value: `http://localhost:${this.Port}/api` },
    { Key: "Health", Value: `http://localhost:${this.Port}/health` }
]);
console.log(`
╚════════════════════════════════════════════════════════╝
`);
}
}

const d = new D();

module.exports = d
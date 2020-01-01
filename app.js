const dotenv = require('dotenv');
const neo4j = require('neo4j-driver').v1;
const uuid = require('uuid/v4');
const express = require('express');
const bodyParser = require('body-parser');

const url = 'bolt://hobby-hfoifgnijmdigbkeejgfkfdl.dbs.graphenedb.com:24787';
const user = 'production';
const pass = 'b.lRblDxIqP9AP.B03kyDDYm7gjs0dy';
const port = 3000;

class Api {
  constructor() {
    this.driver = neo4j.driver(url, neo4j.auth.basic(user, pass));
  }

  createNode(type, name) {
    const session = this.driver.session();
    let response;
    if (type === 'person') {
      response = session
      .run('CREATE (n:Osoba { name: {name}, uuid: {uuid} })', {
        name,
        uuid: uuid(),
      });
    } else if (type === 'city') {
      response = session
      .run('CREATE (n:Miasto { name: {name}, uuid: {uuid} })', {
        name,
        uuid: uuid(),
      });
    } else if (type === 'country') {
      response = session
      .run('CREATE (n:Kraj { name: {name}, uuid: {uuid} })', {
        name,
        uuid: uuid(),
      });
    }

    response
      .then(() => session.close())
      .catch(() => session.close());

    return response;
  }

  createRelationship(type, id1, id2) {
    const session = this.driver.session();
    let response;
    if (type === 'person-person') {
      response = session
      .run('MATCH (a:Osoba {uuid: {id1}}),(b:Osoba {uuid: {id2}}) MERGE (a)-[r:KNOWS]-(b) return a,b', {
        id1,
        id2,
      });
    } else if (type === 'person-city') {
      response = session
      .run('MATCH (a:Osoba {uuid: {id1}}),(b:Miasto {uuid: {id2}}) MERGE (a)-[r:VISITED]->(b) return a,b', {
        id1,
        id2,
      });
    } else if (type === 'city-country') {
      response = session
      .run('MATCH (a:Miasto {uuid: {id1}}),(b:Kraj {uuid: {id2}}) MERGE (a)-[r:BELONGS]->(b) return a,b', {
        id1,
        id2,
      });
    }

    response
      .then(() => session.close())
      .catch(() => session.close());

    return response;
  }

  getNodes() {
    const session = this.driver.session();
    const promise = new Promise((resolve, reject) => {
      session
      .run('MATCH (n) RETURN n')
      .then((result1) => {
        const nodes = [];

        result1.records.forEach((record) => {
          nodes.push({
            type: record._fields[0].labels[0],
            uuid: record._fields[0].properties.uuid,
            name: record._fields[0].properties.name,
          });
        });

        resolve(nodes);
        session.close();
      })
      .catch((error) => {
        session.close();
        reject(error);
      });
    });

    return promise;
  }

  getRelationships() {
    const session = this.driver.session();
    const promise = new Promise((resolve, reject) => {
      session
      .run('MATCH p=()-->() RETURN p')
      .then((result2) => {
        const rels = [];

        result2.records.forEach((record) => {
          rels.push({
            type: record._fields[0].segments[0].relationship.type,
            name1: record._fields[0].segments[0].start.properties.name,
            name2: record._fields[0].segments[0].end.properties.name,
          });
        });

        resolve(rels);
        session.close();
      })
      .catch((error) => {
        session.close();
        reject(error);
      });
    });

    return promise;
  }

  clearAll() {
    const session = this.driver.session();
    return session.run('MATCH (n) OPTIONAL MATCH (n)-[r]-() DELETE n,r');
  }

  close() {
    this.driver.close();
  }
}


const app = express();
const db = new Api();

dotenv.config();

app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(`${__dirname}/public`));

app.get('/', (req, res) => {
  db.getRelationships()
    .then((rels) => {
      db.getNodes()
      .then((nodes) => { res.render('./home.pug', { rels, nodes }); })
      .catch(error => res.status(500).send(error));
    })
    .catch(error => res.status(500).send(error));
});

app.post('/postNode', (req, res) => {
  const type = req.body.type;
  const name = req.body.name;
  db.createNode(type, name)
    .then(() => res.redirect('/'))
    .catch(error => res.status(500).send(error));
});

app.post('/postRelationship', (req, res) => {
  const type = req.body.type;
  const id1 = req.body.id1;
  const id2 = req.body.id2;
  db.createRelationship(type, id1, id2)
    .then(() => res.redirect('/'))
    .catch(error => res.status(500).send(error));
});

app.post('/clear', (req, res) => {
  db.clearAll()
    .then(() => res.redirect('/'))
    .catch(error => res.status(500).send(error));
});

app.listen(port, () => console.log(`Aplikacja uruchomiona na http://localhost:${port}`));

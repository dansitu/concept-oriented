// Repo of functions. Temporary.
var FUNCREPO = {
  // Used by sensor
  read: function() {
    return 50;
  },
  // Used by data
  value: function() {
    return this.getAttribute('sensor').call('read');
  },
  test_and_alert: function() {
    var value = this.getAttribute('value');
    var threshold = this.getAttribute('threshold');
    if(value > threshold) {
      console.log('Alerting with value ' + value);
    }
  },
  poll_shared: function() {
    var self = this;
    var action = self.getAttribute('action');
    var period = self.getAttribute('period');
    if(!action || !period) {
      console.log('tried polling but no action or period');
      return;
    }
    setInterval(function() {
      console.log('polling');
      self.makeCall(action);
    }, period);
  }
};

var rootConcept = new Concept('concept', ['name'], [], []);

function Concept(name, attributes, behaviours, sharedConcepts) {

  var self = this;

  self.name = name;

  self.attributes = attributes || [];
  self.attributesHash = {};
  // So we can look up the index for each attribute easily
  self.attributes.forEach(function(attribute, index) {
    self.attributesHash[attribute] = index;
  });

  self.behaviours = behaviours || [];
  self.getBehavioursByAttribute = {};
  self.callableBehavioursByName = {};
  self.immediateBehavioursByName = {};
  self.behaviours.forEach(function(behaviourName) {
    var details = behaviourName.split('~');
    var type = details[0];
    var name = details[1];

    if(type === 'get') {
      self.getBehavioursByAttribute[name] = FUNCREPO[name];
    } else if(type === 'callable') {
      self.callableBehavioursByName[name] = FUNCREPO[name];
    } else if(type === 'immediate') {
      self.immediateBehavioursByName[name] = FUNCREPO[name];
    }
  });

  self.store = {};


  // Although since registering shared concepts involves calling immediate
  // behaviours, this needs to happen last!
  sharedConcepts = sharedConcepts || [];
  self.sharedConceptsHash = {};
  sharedConcepts.forEach(function(conceptName) {
    var shared = rootConcept.getInstance(conceptName);
    self.registerShared(shared);
  });

  // Only once everything else is set up, call immediate behaviours
  Object.keys(self.immediateBehavioursByName).forEach(function(name) {
    self.immediateBehavioursByName[name].call(self);
  });

};

Concept.prototype.registerShared = function(newSharedConcept) {
  var self = this;
  console.log('Adding shared concept ' + newSharedConcept.name + ' to concept ' + self.name);
  // Add to our list of shared concepts
  self.sharedConceptsHash[newSharedConcept.name] = newSharedConcept;
  // Call any of the new concepts immediate behaviours on the current concept
  Object.keys(newSharedConcept.immediateBehavioursByName).forEach(function(name) {
    newSharedConcept.immediateBehavioursByName[name].call(self);
  });
  // Also register any parent shared concepts
  Object.keys(newSharedConcept.sharedConceptsHash).forEach(function(conceptName) {
    self.registerShared(newSharedConcept.sharedConceptsHash[conceptName]);
  });
};

// Return the instance with this name
Concept.prototype.getInstance = function(name) {
  return this.store[name];
};

Concept.prototype.getAttribute = function(name) {
  console.log('Attempting to get attribute ' + name + ' from concept ' + this.name);
  if(this.name === 'emailDan') {
    console.log(this);
  }
  // TODO: Also check linked concepts for get behaviours
  var getter = this.getBehavioursByAttribute[name];
  if(getter) {
    return getter();
  }
  // If this is a row concept, just return the value from the store
  // array at the correct index
  if(this.sharedConceptsHash['row']) {
    return this.store[this.attributesHash[name]];
  } else {
    // Otherwise, the store is an object and we can find the concept
    // we are looking for by name. We can then call getAttribute to find
    // the value we want.
    var concept = this.store[name];
    if(concept) {
      return concept.getAttribute(name);
    }
    return null;
  }
};

Concept.prototype.makeCall = function(name) {
  // Call a callable behaviour
};

Concept.prototype.add = function(input) {
  if(input instanceof Concept) {
    this.store[input.name] = input;
  } else {
    // Assume this follows the format of the current concept
    var rowConcept = new Concept(input.name, this.attributes, this.behaviours, ['row']);
    // In this case, how do we share behaviours? Right now they are not being shared.
    rowConcept.store = input.attributeValues;
    this.store[rowConcept.name] = rowConcept;
    rowConcept.registerShared(this);
  }


  // TODO:
  // Go through this concept's behaviours and see
  // if any should act on this item.
  // Go through shared concepts' behaviours and see
  // if any should act on this item.
  // Add item to our store.
};

rootConcept.add(new Concept('row'));
rootConcept.add(new Concept('ongoing', [], ['immediate~poll_shared']));

rootConcept.add(new Concept('sensor', ['type', 'port'], ['callable~read']));
rootConcept.getInstance('sensor').add({ name: 'dht22', attributeValues: ['temperature', '999'] });

rootConcept.add(new Concept('data', ['sensor:sensor', 'value'], ['get~value']));
rootConcept.getInstance('data').add({ name: 'temperature', attributeValues: [rootConcept.getInstance('sensor').getInstance('dht22')]});

rootConcept.add(new Concept('alert', ['sensordata:data', 'threshold', 'period', 'action'], ['callable~test_and_alert'], ['ongoing']));
rootConcept.getInstance('alert').add({ name: 'emailDan', attributeValues: [ rootConcept.getInstance('data').getInstance('temperature'), 90, 4000, 'test_and_alert']});



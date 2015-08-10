//TODO::
// - Make a promise based API to support async
// - Rather than duplicating behaviours from shared concepts
//   on the current concept, find them from further up the tree
// - getAttribute should find attributes from shared concepts too
// - shared concept should be related concept or linked concept?
// - should concepts be named traits? and linked concepts cotraits?
// - syntax and mechanism for type checking of attributes (specify concept or js type)

var rootConcept = new Concept('concept', ['name'], [], []);

function Concept(details) {

  var self = this;

  self.name = details.name;

  self.attributes = details.attributes || [];
  self.attributesHash = {};
  // So we can look up the index for each attribute easily
  self.attributes.forEach(function(attribute, index) {
    self.attributesHash[attribute] = index;
  });

  self.behaviours = details.behaviours || {};
  if(!self.behaviours.immediate) {
    self.behaviours.immediate = {};
  }
  if(!self.behaviours.callable) {
    self.behaviours.callable = {};
  }
  if(!self.behaviours.getter) {
    self.behaviours.getter = {};
  }

  self.store = {};

  self.sharedConceptsHash = {};
  self.sharedConcepts = details.sharedConcepts || [];
  self.sharedConcepts.forEach(function(conceptName) {
    var shared = rootConcept.getInstance(conceptName);
    self.registerShared(shared);
  });

  // Only once everything else is set up, call immediate behaviours
  Object.keys(self.behaviours.immediate).forEach(function(name) {
    self.behaviours.immediate[name].call(self);
  });

};

Concept.prototype.registerShared = function(newSharedConcept) {
  var self = this;
  console.log('Adding shared concept ' + newSharedConcept.name + ' to concept ' + self.name);
  // Add to our list of shared concepts
  self.sharedConceptsHash[newSharedConcept.name] = newSharedConcept;
  // Call any of the new concepts immediate behaviours on the current concept
  Object.keys(newSharedConcept.behaviours.immediate).forEach(function(name) {
    newSharedConcept.behaviours.immediate[name].call(self);
  });
  // Add any getter behaviours and callable behaviours
  Object.keys(newSharedConcept.behaviours.getter).forEach(function(name) {
    self.behaviours.getter[name] = newSharedConcept.behaviours.getter[name];
  });
  Object.keys(newSharedConcept.behaviours.callable).forEach(function(name) {
    self.behaviours.callable[name] = newSharedConcept.behaviours.callable[name];
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
  // TODO: Also check linked concepts for get behaviours
  var getter = this.behaviours.getter[name];
  if(getter) {
    return getter.call(this);
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
  console.log('Trying to call ' + name + ' on concept ' + this.name);
  return this.behaviours.callable[name].apply(this, Array.prototype.slice.call(arguments, 1));
};

Concept.prototype.add = function(input) {
  if(input instanceof Concept) {
    this.store[input.name] = input;
  } else {
    // Assume this follows the format of the current concept
    var rowConcept = new Concept({
      name: input.name,
      attributes: this.attributes,
      behaviours: this.behaviours,
      sharedConcepts: ['row']
    });
    // Row concepts just have an array of data in their store
    rowConcept.store = input.attributeValues;
    // Add the rowConcept to the current concept
    this.store[rowConcept.name] = rowConcept;
    // Then register this as a shared concept of the rowConcept
    rowConcept.registerShared(this);
  }
};

rootConcept.add(new Concept({ name: 'row' }));
rootConcept.add(new Concept({
  name: 'ongoing',
  behaviours: {
    immediate: {
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
    }
  }
}));

var learn = function(parentConceptName, concept) {
  if(concept) {
    rootConcept
      .getInstance(parentConceptName)
      .add(concept);
  } else {
    concept = parentConceptName;
    rootConcept.add(new Concept(concept));
  }
};


learn({
  name: 'sensor',
  attributes: ['type', 'port'],
  behaviours: {
    callable: {
      read: function() {
        return 100;
      }
    }
  }
});
learn('sensor', { name: 'dht22', attributeValues: ['temperature', '999'] });

learn({
  name: 'data',
  attributes: ['sensor', 'value'],
  behaviours: {
    getter: {
      value: function() {
        return this.getAttribute('sensor').makeCall('read');
      }
    }
  }
});
learn('data', { name: 'temperature', attributeValues: [rootConcept.getInstance('sensor').getInstance('dht22')]});

learn({
  name: 'alert',
  attributes: ['data', 'threshold', 'period', 'action'],
  behaviours: {
    callable: {
      test_and_alert: function() {
        var value = this.getAttribute('data').getAttribute('value');
        var threshold = this.getAttribute('threshold');
        console.log('value'  + value);
        console.log('threshold' + threshold);
        if(value > threshold) {
          console.log('Alerting with value ' + value);
        }
      }
    }
  },
  sharedConcepts: ['ongoing']
});
learn('alert', { name: 'emailDan', attributeValues: [ rootConcept.getInstance('data').getInstance('temperature'), 90, 4000, 'test_and_alert']});


// Possible new DSL
// learn({ name: 'row' })
//   .then(learn({
//     name: 'ongoing',
//     behaviours: {
//       immediate: {
//         poll_shared: function() {
//           var self = this;
//           self
//             .getAttributes(['action', 'period'])
//             .then(function(action, period) {
//               if(!action || !period) {
//                 throw new NonFatalError('Tried polling but no action or period');
//               }
//               setInterval(function() {
//                 console.log('polling');
//                 self.makeCall(action);
//               }, period);
//             });
//         }
//       }
//     }
//   }))
//   .then(learn({
//     name: 'sensor',
//     attributes: ['type', 'port'],
//     behaviours: {
//       callable: {
//         read: function() {
//           return Promise.fulfil(100);
//         }
//       }
//     }
//   }));

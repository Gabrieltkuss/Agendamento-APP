const mongoose = require('mongoose');
const URI = 'mongodb+srv://salaoUser:r7zs6vY39SzwQp0i@clusterdev.rpl0khr.mongodb.net/salao-na-mao?retryWrites=true&w=majority&appName=ClusterDev';

// mongoose.set('useNewUrlParser', true);
// mongoose.set('useFindAndModify', false);
// mongoose.set('useCreateIndex', true);
// mongoose.set('useUnifiedTopology', true);

// mongoose
//     .connect(URI)
//     .then(() => console.log('DB is UP!'))
//     .catch(() => console.log(err));

mongoose
    .connect(URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true
    })
    .then(() => console.log('DB is UP!'))
    .catch((err) => console.log(err));

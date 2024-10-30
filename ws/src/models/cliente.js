const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const cliente = new Schema({
    nome: {
        type: String,
        required: true,
    },
    telefone: {
        type: String,
        required: true,
        unique: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    senha: {
        type: String,
        required: true,
    },
    // foto: {
    //     type: String,
    //     required: true,
    // },
    dataNascimento: {
        type: Date,
        required: true,
    },
    sexo: {
        type: String,
        enum: ['M', 'F'],
        required: true,
      },
    status: {
        type: String,
        enum: ['A','E','I'],
        default: 'A',
        required: true,
    },
    customerId: {
        type: String,
        required: true,
    },
    dataCadastro: {
        type: Date,
        default: Date.now,
    },
    documento: {
        tipo: {
            type: String,
            enum: ['cpf','cnpj'],
            required: true,
        },
        numero: {
            type: String,
            required: true,
        },
    },
    endereco: {
        cidade: String,
        uf: String,
        cep: String,
        logradouro: String,
        numero: String,
        pais: String,
      },
});

module.exports = mongoose.model('Cliente', cliente);
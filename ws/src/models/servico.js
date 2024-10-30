const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const servico = new Schema({
    salaoId: {
        type: mongoose.Types.ObjectId,
        ref: 'Salao',
    },
    titulo: {
        type: String,
        required: true,
    },
    preco: {
        type: Number,
        required: true,
    },
    comissao: {
        type: Number, // comissão em porcentagem sobre o preço
        required: true,
    },
    duracao: {
        type: Date, // Duração em minutos
        required: true,
    },
    recorrencia: {
        type: Number, // periodo de recorrencia do serviço em dias
        required: true,
    },
    descricao: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ['A','I','E'],
        default: 'A',
        required: true,
    },
    dataCadastro: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Servico', servico);
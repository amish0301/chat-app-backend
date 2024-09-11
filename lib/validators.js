const { body, validationResult, param } = require("express-validator");
const { ErrorHandler } = require("../utils/ErrorHandler");

const validateHandler = (req, res, next) => {
  const errors = validationResult(req);
  const allErrors = errors
    .array()
    .map((error) => error.message)
    .join(", ");

  if (errors.isEmpty()) return next();
  else return next(new ErrorHandler(allErrors, 400));
};

const registerValidator = () => [
  body("name", "Please Enter Name").notEmpty(),
  body("username", "Please Enter User Name").notEmpty(),
  body("password", "Please Enter Password").notEmpty(),
  body("bio", "Please Enter Bio").notEmpty(),
];

const loginValidator = () => [
  body("username", "Please Enter User Name").notEmpty(),
  body("password", "Please Enter Password").notEmpty(),
];

const newChatValidator = () => [
  body("name", "Please Enter Chat/Group Name").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please Enter Members")
    .isArray({ min: 2, max: 100 })
    .withMessage("Please Enter Atleast 2 Members"),
];

const addMemberValidator = () => [
  body("chatId", "Please Enter Chat Id").notEmpty(),
  body("members")
    .notEmpty()
    .withMessage("Please Enter Members")
    .isArray({ min: 1, max: 97 })
    .withMessage("Please Enter Atleast 2 Members"),
];

const removeMemberValidator = () => [
  body("chatId", "Please Enter Chat Id").notEmpty(),
  body("userId", "Please Enter User Id").notEmpty(),
];

const sendAttachmentsValidator = () => [
  body("chatId", "Please Enter Chat Id").notEmpty(),
];

const chatIdValidator = () => [param("id", "Please Enter Chat Id").notEmpty()];

const renameGroupValidator = () => [
  param("id", "Please Enter Chat Id").notEmpty(),
  body("name", "Please Enter New Group Name").notEmpty(),
];

const sendRequestValidator = () => [
  body("receiverId", "Please Enter User Id").notEmpty(),
];

const acceptrequestValidator = () => [
  body("requestId", "Please Enter Request ID").notEmpty(),
  body("accept")
    .notEmpty()
    .withMessage("Please Enter Accept")
    .isBoolean()
    .withMessage("Accept must be boolean"),
];

const adminLoginValidator = () => [
  body("secretKey", "Please Enter Secret Key").notEmpty(),
]

module.exports = {
  registerValidator,
  loginValidator,
  validateHandler,
  newChatValidator,
  addMemberValidator,
  removeMemberValidator,
  sendAttachmentsValidator,
  chatIdValidator,
  renameGroupValidator,
  sendRequestValidator,
  acceptrequestValidator,
  adminLoginValidator
};

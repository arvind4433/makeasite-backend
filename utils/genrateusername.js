const generateUsername = () => {
    const randomString = Math.random().toString(36).substring(2, 8);
    return `user_${randomString}`;
}
export default generateUsername;
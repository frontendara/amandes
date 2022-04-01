function defaults<T>(obj: Partial<T>, defaultsObj: T){
  for (const key in defaultsObj) {
    if (!(key in obj)) {
      obj[key] = defaultsObj[key];
    }
  }
  // TODO: this needs better typing
  return obj as T;
}

export default defaults;

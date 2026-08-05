/**
 * 发送POST请求
 * @param url 请求URL
 * @param data 请求数据
 * @returns 响应数据
 */
export const postRequest = async (param: { url: string, data?: any, headers?: any }) => {
  const { url, data = {}, headers } = param;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(data),
    })
    return await response.json()
  } catch (error) {
    console.error(error)
    return {
      success: false,
      message: "请求失败",
      data: null,
    }
  }
}

/**
 * 发送GET请求
 * @param url 请求URL
 * @returns 响应数据
 */
export const getRequest = async (url: string) => {
  try {
    const response = await fetch(url, {
      method: "GET",
    })
    return await response.json()
  } catch (error) {
    console.error(error)
    return {
      success: false,
      message: "请求失败",
      data: null,
    }
  }
}